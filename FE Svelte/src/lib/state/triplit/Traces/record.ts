import { CodedError } from '$lib/model/Errors/CodedError';
import { createEvidenceAssessmentInTransaction } from '../IntentionAssessments/create';
import { editIntentionAssessmentInTransaction } from '../IntentionAssessments/IntentionAssessments';
import { linkSourceId, resolveLinkSource } from '../IntentionAssessments/binding';
import type { IntentionAssessment, IntentionAssessmentValues } from '../IntentionAssessments/types';
import {
	createIntersectionInTransaction,
	setIntersectionDeletedInTransaction
} from '../Intersections/Intersections';
import { intersectionIdFor, normalizeIntersection } from '../Intersections/read';
import { RepositoryError } from '../Repository/errors';
import { newOperation, requireEntity, type Operation } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import type {
	Intersection,
	JsonObject,
	LogActor,
	Trace,
	TraceAboutKind,
	TraceAboutTime,
	TraceDuration,
	TracePatch,
	TraceRelation
} from '../types';
import { createTraceInTransaction } from './create';
import { editTraceInTransaction } from './edit';
import { storedTraceText, type TraceRecordTextInput } from './fields';
import { validateManualIntentionTime } from './intention-time';
import { normalizeTrace } from './read';
import { assertSupplementIntegrity } from './supplement';

/** Relations the saved record enters explicitly; the saved Trace is always one endpoint. */
export type TraceRecordLinkInput =
	| { kind: 'evidence_for'; intentionId: string; assessment?: IntentionAssessmentValues }
	| { kind: 'evidence_for'; factId: string; assessment?: IntentionAssessmentValues }
	| { kind: 'part_of'; wholeId: string }
	| { kind: 'revisits'; originalId: string }
	| { kind: 'related_to'; traceId: string };

export type TraceRecordFields = TraceRecordTextInput & {
	relation?: TraceRelation | null;
	capturedAt?: string;
	timezone?: string;
	aboutKind?: TraceAboutKind;
	aboutTime?: TraceAboutTime | null;
	aboutTraceId?: string | null;
	statedDuration?: TraceDuration | null;
	/** Create only: the pinned Kind/KindV of a typed record. */
	kindId?: string | null;
	kindVId?: string | null;
	data?: JsonObject | null;
};

/**
 * One form save. Without `id` it creates the Trace; with `id` it edits the same Trace, and
 * every other part is an explicit delta: absent parts are untouched, nothing is resubmitted.
 * `assessments` carries only values the user entered for existing evidence links.
 */
export type TraceRecordSave = {
	id?: string;
	fields: TraceRecordFields;
	memberships?: { add?: readonly string[]; remove?: readonly string[] };
	links?: { add?: readonly TraceRecordLinkInput[]; remove?: readonly string[] };
	assessments?: readonly { evidenceId: string; values: IntentionAssessmentValues }[];
};

export type TraceRecordResult = {
	trace: Trace;
	operation: Operation;
	links: Intersection[];
	assessments: IntentionAssessment[];
};

const temporalFields = ['aboutKind', 'aboutTime', 'aboutTraceId', 'statedDuration'] as const;

/** The save's own operation time is `now`: the refusal is reproducible from the journal. */
const assertIntentionTime = (original: Trace | null, next: Trace, operation: Operation): void => {
	const check = validateManualIntentionTime(original, next, Date.parse(operation.timestamp));
	if (!check.ok) {
		throw new RepositoryError(
			'intention_time_past',
			'Новая дата намерения должна быть в будущем; дату можно снять.',
			{ reason: check.reason }
		);
	}
};

const createRecord = async (
	transaction: Transaction,
	save: TraceRecordSave,
	actor: LogActor,
	operation: Operation
): Promise<Trace> => {
	const { fields } = save;
	const typed = (fields.kindId ?? null) !== null;
	if (!fields.capturedAt || !fields.timezone || !fields.aboutKind) {
		throw new RepositoryError(
			'record_fields',
			'Для новой записи нужны время создания, часовой пояс и вид размещения.'
		);
	}
	const text = storedTraceText(typed, fields, true);
	const draft = {
		content: text.content ?? '',
		description: text.description ?? null,
		capturedAt: fields.capturedAt,
		timezone: fields.timezone,
		aboutKind: fields.aboutKind,
		aboutTime: fields.aboutTime ?? null,
		aboutTraceId: fields.aboutTraceId ?? null,
		statedDuration: fields.statedDuration ?? null,
		relation: fields.relation ?? null,
		kindId: fields.kindId ?? null,
		kindVId: fields.kindVId ?? null,
		data: fields.data ?? null
	};
	const trace = await createTraceInTransaction(
		transaction,
		draft,
		save.memberships?.add ?? [],
		actor,
		operation
	);
	assertIntentionTime(null, trace, operation);
	return trace;
};

const editRecord = async (
	transaction: Transaction,
	save: TraceRecordSave & { id: string },
	actor: LogActor,
	operation: Operation
): Promise<Trace> => {
	const before = normalizeTrace(await requireEntity(transaction, 'traces', save.id));
	const { fields } = save;
	if (fields.kindId !== undefined || fields.kindVId !== undefined) {
		throw new RepositoryError('kind_pinned', 'Kind и версия сохранённой записи не меняются.');
	}
	const patch: TracePatch = { ...storedTraceText(before.kindId !== null, fields, false) };
	for (const key of ['relation', 'capturedAt', 'timezone', 'data', ...temporalFields] as const) {
		if (Object.hasOwn(fields, key)) (patch as Record<string, unknown>)[key] = fields[key];
	}
	const after = await editTraceInTransaction(transaction, save.id, patch, actor, operation);
	assertIntentionTime(before, after, operation);
	return after;
};

const applyMemberships = async (
	transaction: Transaction,
	trace: Trace,
	save: TraceRecordSave,
	actor: LogActor,
	operation: Operation
): Promise<void> => {
	if (!save.id) return;
	for (const scopeId of new Set(save.memberships?.add ?? [])) {
		const scope = await requireEntity(transaction, 'scopes', scopeId);
		if (scope.isDeleted) throw new CodedError('scope_missing', 'Выберите существующий Scope.');
		await createIntersectionInTransaction(
			transaction,
			{ fromId: trace.id, toId: scopeId, kind: 'belongs_to' },
			actor,
			operation
		);
	}
	for (const scopeId of new Set(save.memberships?.remove ?? [])) {
		const id = intersectionIdFor(trace.id, scopeId, 'belongs_to');
		await requireEntity(transaction, 'intersections', id);
		await setIntersectionDeletedInTransaction(transaction, id, true, actor, operation);
	}
};

const applyLinks = async (
	transaction: Transaction,
	trace: Trace,
	save: TraceRecordSave,
	actor: LogActor,
	operation: Operation,
	result: TraceRecordResult
): Promise<void> => {
	for (const input of save.links?.add ?? []) {
		const draft =
			input.kind === 'evidence_for'
				? 'intentionId' in input
					? { fromId: trace.id, toId: input.intentionId, kind: input.kind }
					: { fromId: input.factId, toId: trace.id, kind: input.kind }
				: input.kind === 'part_of'
					? { fromId: trace.id, toId: input.wholeId, kind: input.kind }
					: input.kind === 'revisits'
						? { fromId: trace.id, toId: input.originalId, kind: input.kind }
						: { fromId: trace.id, toId: input.traceId, kind: input.kind };
		const link = await createIntersectionInTransaction(transaction, draft, actor, operation);
		result.links.push(link);
		if (input.kind === 'evidence_for' && input.assessment) {
			result.assessments.push(
				await createEvidenceAssessmentInTransaction(
					transaction,
					link.id,
					input.assessment,
					actor,
					operation
				)
			);
		}
	}
	for (const linkId of save.links?.remove ?? []) {
		const row = await requireEntity(transaction, 'intersections', linkId);
		if (row.fromId !== trace.id && row.toId !== trace.id) {
			throw new RepositoryError('link_foreign', 'Связь не относится к сохраняемой записи.', {
				linkId
			});
		}
		result.links.push(
			(await setIntersectionDeletedInTransaction(transaction, linkId, true, actor, operation)).link
		);
	}
};

const applyAssessments = async (
	transaction: Transaction,
	trace: Trace,
	save: TraceRecordSave,
	actor: LogActor,
	operation: Operation,
	result: TraceRecordResult
): Promise<void> => {
	for (const { evidenceId, values } of save.assessments ?? []) {
		const row = await requireEntity(transaction, 'intersections', evidenceId);
		if (row.fromId !== trace.id && row.toId !== trace.id) {
			throw new RepositoryError('link_foreign', 'Связь не относится к сохраняемой записи.', {
				linkId: evidenceId
			});
		}
		const link = normalizeIntersection(row);
		const source = resolveLinkSource(
			link,
			await transaction.fetchById('intentionAssessments', linkSourceId(link))
		);
		result.assessments.push(
			source.status === 'current'
				? (
						await editIntentionAssessmentInTransaction(
							transaction,
							source.assessment.id,
							values,
							actor,
							operation
						)
					).assessment
				: await createEvidenceAssessmentInTransaction(
						transaction,
						evidenceId,
						values,
						actor,
						operation
					)
		);
	}
};

/**
 * Creates or edits one Trace together with its explicit memberships, relations and entered
 * assessments in a single transaction and operation; every check happens before commit, so
 * a failing last part leaves no Trace, membership, source or journal fragment.
 */
export const saveTraceRecordInTransaction = async (
	transaction: Transaction,
	save: TraceRecordSave,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<TraceRecordResult> => {
	const trace = save.id
		? await editRecord(transaction, { ...save, id: save.id }, actor, operation)
		: await createRecord(transaction, save, actor, operation);
	const result: TraceRecordResult = { trace, operation, links: [], assessments: [] };
	await applyMemberships(transaction, trace, save, actor, operation);
	await applyLinks(transaction, trace, save, actor, operation, result);
	await applyAssessments(transaction, trace, save, actor, operation, result);
	await assertSupplementIntegrity(transaction, trace.id);
	result.trace = normalizeTrace(await requireEntity(transaction, 'traces', trace.id));
	return result;
};

export const createTraceRecordRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'saveTraceRecord'> => ({
	saveTraceRecord: async (save, actor = 'user') => {
		await client.ready?.();
		return client.transact((transaction) => saveTraceRecordInTransaction(transaction, save, actor));
	}
});
