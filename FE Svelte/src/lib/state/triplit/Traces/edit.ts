import { RepositoryError } from '../Repository/errors';
import { insertLog } from '../Repository/log';
import { newOperation, requireEntity, type Operation } from '../Repository/transaction';
import type { Transaction } from '../Repository/types';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import { assertIsoTimestamp } from '../trace-time';
import type { JsonObject, LogActor, Trace, TraceAboutTime, TracePatch } from '../types';
import { assertTraceTyping, prepareTraceTemporalPlacement } from './create';
import { encodedTraceFieldPatch, parseTraceEncoding } from './json-encoding';
import { normalizeTrace } from './read';
import { assertRelationChangeAllowed } from './roles';
import { traceRevisionStamps, traceRevisions } from './revisions';
import { assertSupplementIntegrity, isSupplementMarker } from './supplement';

const sameJson = (left: unknown, right: unknown): boolean =>
	JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

/**
 * Scalars merge as they always did; a changed aboutTime or data is rewritten atomically as
 * `[value]` with its marker, so removed keys really disappear on every replica.
 */
const storedTracePatch = (
	stored: Record<string, unknown>,
	requested: Record<string, unknown>,
	before: Trace,
	after: Trace
): Record<string, unknown> => {
	const { aboutTime, data, ...scalars } = requested;
	const patch: Record<string, unknown> = { ...scalars, updatedAt: after.updatedAt };
	let encoding = parseTraceEncoding(stored.encoding);
	if (Object.hasOwn(requested, 'aboutTime') && !sameJson(before.aboutTime, aboutTime)) {
		Object.assign(
			patch,
			encodedTraceFieldPatch('aboutTime', aboutTime as TraceAboutTime | null, encoding)
		);
		encoding = patch.encoding as typeof encoding;
	}
	if (Object.hasOwn(requested, 'data') && !sameJson(before.data, data)) {
		Object.assign(patch, encodedTraceFieldPatch('data', data as JsonObject | null, encoding));
	}
	return patch;
};

const traceFields = [
	'content',
	'description',
	'capturedAt',
	'timezone',
	'aboutKind',
	'aboutTime',
	'statedDuration',
	'aboutAt',
	'aboutStart',
	'aboutEnd',
	'aboutTraceId',
	'relation',
	'data'
] as const;

/** Validates and applies a Trace patch; the operation supplies the journal identity and time. */
export const editTraceInTransaction = async (
	transaction: Transaction,
	id: string,
	patch: TracePatch,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<Trace> => {
	const storedBefore = await requireEntity(transaction, 'traces', id);
	const before = normalizeTrace(storedBefore);
	const hasDataPatch = Object.hasOwn(patch, 'data');
	const hasTemporalPatch =
		Object.hasOwn(patch, 'statedDuration') ||
		Object.hasOwn(patch, 'aboutKind') ||
		Object.hasOwn(patch, 'aboutTime') ||
		Object.hasOwn(patch, 'aboutTraceId');
	const requested: Record<string, unknown> = {
		...patch,
		...(hasDataPatch ? { data: patch.data ?? null } : {})
	};
	if (
		before.kindId === null &&
		Object.hasOwn(patch, 'content') &&
		patch.content?.trim().length === 0
	) {
		throw new Error('Trace content is required');
	}
	if (before.kindId !== null && (patch.description ?? null) !== null) {
		throw new Error('Typed Trace keeps its description in content');
	}
	if (Object.hasOwn(patch, 'capturedAt') && patch.capturedAt !== undefined) {
		assertIsoTimestamp(patch.capturedAt, 'Trace capturedAt');
	}
	if (
		Object.hasOwn(patch, 'timezone') &&
		(patch.timezone?.trim().length === 0 || patch.timezone !== patch.timezone?.trim())
	) {
		throw new Error('Trace timezone must be a non-empty trimmed string');
	}
	if (Object.hasOwn(patch, 'relation')) {
		await assertRelationChangeAllowed(transaction, id, before.relation, patch.relation ?? null);
	}
	if (hasTemporalPatch) {
		Object.assign(
			requested,
			await prepareTraceTemporalPlacement(
				transaction,
				id,
				patch.aboutKind ?? before.aboutKind,
				Object.hasOwn(patch, 'aboutTime') ? (patch.aboutTime ?? null) : before.aboutTime,
				Object.hasOwn(patch, 'aboutTraceId') ? (patch.aboutTraceId ?? null) : before.aboutTraceId,
				Object.hasOwn(patch, 'statedDuration') ? patch.statedDuration : before.statedDuration
			)
		);
	}
	if (hasDataPatch) {
		await assertTraceTyping(transaction, before.kindId, before.kindVId, requested.data);
	}
	const after = { ...before, ...requested, updatedAt: operation.timestamp };
	// A supplement stays a reference without its own time; resubmitting its shape is not a change,
	// turning it into a dated or inline record is refused. The reverse conversion is judged by
	// the command's integrity check, since a marker needs its one revisits link.
	if (isSupplementMarker(before) && !isSupplementMarker(after as Trace)) {
		throw new RepositoryError(
			'supplement_placement',
			'Дополнение не получает собственную дату: оно относится к оригиналу.',
			{ traceId: id }
		);
	}
	const fieldPatches = buildFieldPatches(before, after, traceFields);
	// JSON fields compare by value: resubmitting the same object is not a change.
	for (const field of ['aboutTime', 'statedDuration', 'data'] as const) {
		if (field in fieldPatches && sameJson(before[field], after[field])) delete fieldPatches[field];
	}
	if (Object.keys(fieldPatches).length === 0) return normalizeTrace(before);
	// Each changed field is stamped with this operation; untouched stamps stay as they are.
	await transaction.update('traces', id, {
		...storedTracePatch(storedBefore, requested, before, after as Trace),
		revisions: traceRevisionStamps(Object.keys(fieldPatches), operation.id)
	});
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: operation.timestamp,
		entityType: 'trace',
		entityId: id,
		action: 'updated',
		patch: fieldPatches,
		actor,
		cause: operation.cause
	});
	return normalizeTrace(after);
};

/**
 * One deletion or restoration and the operation that wrote it. The operation is `null` when
 * the record already stood as asked: nothing was written, so there is no operation to name and
 * nothing to take back — least of all an earlier command's operation.
 */
export type TraceLifecycleResult = { trace: Trace; operation: Operation | null };

export const setTraceDeletedInTransaction = async (
	transaction: Transaction,
	id: string,
	isDeleted: boolean,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<TraceLifecycleResult> => {
	const before = await requireEntity(transaction, 'traces', id);
	if (Boolean(before.isDeleted) === isDeleted) {
		return { trace: normalizeTrace(before), operation: null };
	}
	// The answer carries the lifecycle stamp this write leaves, as a later read of the row would.
	const stamps = traceRevisionStamps(['isDeleted'], operation.id);
	const after = {
		...before,
		isDeleted,
		updatedAt: operation.timestamp,
		revisions: { ...traceRevisions(before), ...stamps }
	};
	await transaction.update('traces', id, {
		isDeleted,
		updatedAt: after.updatedAt,
		revisions: stamps
	});
	// A restored supplement must still have its one original; nothing is invented for it.
	if (!isDeleted) await assertSupplementIntegrity(transaction, id);
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: operation.timestamp,
		entityType: 'trace',
		entityId: id,
		action: logActionForDeleted(isDeleted),
		patch: buildFieldPatches(before, after, ['isDeleted']),
		actor,
		cause: operation.cause ?? (isDeleted ? 'normal' : 'restore')
	});
	return { trace: normalizeTrace(after), operation };
};
