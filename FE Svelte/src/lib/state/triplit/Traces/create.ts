import { CodedError } from '$lib/model/Errors/CodedError';
import { createIntersectionInTransaction } from '../Intersections/Intersections';
import { normalizeTraceKindV } from '../Kinds/read';
import { insertLog } from '../Repository/log';
import { newOperation, requireEntity, type Operation } from '../Repository/transaction';
import type { Transaction } from '../Repository/types';
import { createId } from '../ids';
import { parseStatedDuration } from '../trace-duration';
import { assertJsonObject, assertTraceData } from '../trace-kind-v-validation';
import {
	assertIsoTimestamp,
	assertTraceTemporalPlacement,
	exactTraceTimeProjection,
	parseTraceAboutTime
} from '../trace-time';
import type { LogActor, Trace, TraceAboutTime, TraceDraft } from '../types';
import { normalizeTrace } from './read';

export const assertTraceTyping = async (
	transaction: Transaction,
	kindId: string | null,
	kindVId: string | null,
	data: unknown
): Promise<void> => {
	if ((kindId === null) !== (kindVId === null)) {
		throw new Error('Trace kindId and kindVId must both be set or both be null');
	}
	if (kindId === null || kindVId === null) {
		if (data !== null) assertJsonObject(data, 'Trace data');
		return;
	}

	await requireEntity(transaction, 'traceKinds', kindId);
	const kindV = normalizeTraceKindV(await requireEntity(transaction, 'traceKindVersions', kindVId));
	if (kindV.kindId !== kindId) {
		throw new Error(`TraceKindV ${kindVId} does not belong to TraceKind ${kindId}`);
	}
	assertTraceData(data, kindV.dataSchema);
};

export const prepareTraceTemporalPlacement = async (
	transaction: Transaction,
	traceId: string,
	aboutKind: Trace['aboutKind'],
	aboutTimeInput: TraceAboutTime | null,
	aboutTraceIdInput: string | null,
	statedDurationInput: unknown = null
) => {
	const aboutTime = aboutTimeInput === null ? null : parseTraceAboutTime(aboutTimeInput);
	const statedDuration = parseStatedDuration(statedDurationInput);
	const aboutTraceId = aboutTraceIdInput ?? null;
	if (
		aboutTraceId !== null &&
		(aboutTraceId.trim().length === 0 || aboutTraceId !== aboutTraceId.trim())
	) {
		throw new Error('Trace aboutTraceId must be a non-empty trimmed string');
	}
	assertTraceTemporalPlacement(aboutKind, aboutTime, aboutTraceId, statedDuration);

	const anchorTraceId = aboutTime?.basis === 'relative' ? aboutTime.anchorTraceId : null;
	const referencedTraceId = aboutKind === 'trace_ref' ? aboutTraceId : anchorTraceId;
	if (referencedTraceId !== null) {
		if (referencedTraceId === traceId)
			throw new Error('Trace temporal placement cannot reference itself');
		await requireEntity(transaction, 'traces', referencedTraceId);
	}

	return {
		aboutKind,
		aboutTime,
		...exactTraceTimeProjection(aboutKind, aboutTime, statedDuration),
		statedDuration,
		aboutTraceId
	};
};

/** Creates the Trace and its memberships; a supplied operation is shared with every write. */
export const createTraceInTransaction = async (
	transaction: Transaction,
	draft: TraceDraft,
	scopeInput: string | readonly string[] | null | undefined,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<Trace> => {
	const scopeIds = [
		...new Set(
			typeof scopeInput === 'string' ? (scopeInput ? [scopeInput] : []) : (scopeInput ?? [])
		)
	];
	for (const scopeId of scopeIds) {
		const scope = await requireEntity(transaction, 'scopes', scopeId);
		if (scope.isDeleted) throw new CodedError('scope_missing', 'Выберите существующий Scope.');
	}
	// A plain record needs its title; a typed record's content is its optional description.
	if ((draft.kindId ?? null) === null && draft.content.trim().length === 0) {
		throw new Error('Trace content is required');
	}
	if ((draft.kindId ?? null) !== null && (draft.description ?? null) !== null) {
		throw new Error('Typed Trace keeps its description in content');
	}
	assertIsoTimestamp(draft.capturedAt, 'Trace capturedAt');
	if (draft.timezone.trim().length === 0 || draft.timezone !== draft.timezone.trim()) {
		throw new Error('Trace timezone must be a non-empty trimmed string');
	}
	const kindId = draft.kindId ?? null;
	const kindVId = draft.kindVId ?? null;
	const data = draft.data ?? null;
	await assertTraceTyping(transaction, kindId, kindVId, data);
	const timestamp = operation.timestamp;
	const id = createId();
	const placement = await prepareTraceTemporalPlacement(
		transaction,
		id,
		draft.aboutKind,
		draft.aboutTime,
		draft.aboutTraceId ?? null,
		draft.statedDuration
	);
	const row = {
		id,
		capturedAt: draft.capturedAt,
		timezone: draft.timezone,
		...placement,
		content: draft.content,
		description: draft.description ?? null,
		relation: draft.relation ?? null,
		kindId,
		kindVId,
		data,
		isDeleted: false,
		createdAt: timestamp,
		updatedAt: timestamp
	};
	await transaction.insert('traces', row);
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: timestamp,
		entityType: 'trace',
		entityId: id,
		action: 'created',
		patch: { snapshot: row },
		actor
	});
	for (const scopeId of scopeIds) {
		await createIntersectionInTransaction(
			transaction,
			{ fromId: id, toId: scopeId, kind: 'belongs_to' },
			actor,
			operation
		);
	}
	return normalizeTrace(row);
};
