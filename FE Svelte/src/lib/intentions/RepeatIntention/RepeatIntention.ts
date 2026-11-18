import { compareAssessmentInstants } from '$lib/state/triplit/IntentionAssessments/read';
import { normalizeIntentionAssessment } from '$lib/state/triplit/IntentionAssessments/read';
import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import { createIntersectionInTransaction } from '$lib/state/triplit/Intersections/Intersections';
import { normalizeIntersection } from '$lib/state/triplit/Intersections/read';
import { newOperation, type Operation } from '$lib/state/triplit/Repository/transaction';
import type {
	RepositoryClient,
	TraceRepository,
	Transaction
} from '$lib/state/triplit/Repository/types';
import { normalizeTrace } from '$lib/state/triplit/Traces/read';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import type { LogActor, Trace } from '$lib/state/triplit/types';
import { saveTraceRecordInTransaction } from '$lib/state/triplit/Traces/record';
import { planPlacement } from '../MoveIntention/MoveIntention';
import { repeatDays } from './targets';
import type { RepeatFailure, RepeatOptions, RepeatOutcome, RepeatResult } from './types';

const refuse = (reason: RepeatFailure): RepeatResult => ({ ok: false, reason });

const laterEvidence = (result: ReturnType<typeof evaluateIntention>, instant: string): boolean =>
	result.sources.some(
		(source) =>
			source.assessment.source === 'evidence' &&
			source.eligibility.eligible &&
			source.orderedAt !== null &&
			compareAssessmentInstants(source.orderedAt, instant) > 0
	);

const sourceState = async (transaction: Transaction, intentionId: string) => {
	const [traceRows, linkRows, assessmentRows] = await Promise.all([
		transaction.fetch('traces'),
		transaction.fetch('intersections'),
		transaction.fetch('intentionAssessments')
	]);
	const traces = traceRows.map((row) => normalizeTrace(row));
	const intersections = linkRows.map((row) => normalizeIntersection(row));
	const assessments = assessmentRows.map((row) => normalizeIntentionAssessment(row));
	const trace = traces.find((item) => item.id === intentionId);
	if (!trace || trace.isDeleted) return { refusal: 'not_found' as const };
	if (!isIntentionRelation(trace.relation)) return { refusal: 'not_intention' as const };
	const result = evaluateIntention(intentionId, assessments, {
		tracesById: new Map(traces.map((item) => [item.id, item])),
		intersectionsById: new Map(intersections.map((item) => [item.id, item]))
	});
	return { trace, traces, intersections, assessments, result };
};

const activeScopes = (
	traceId: string,
	intersections: ReturnType<typeof normalizeIntersection>[],
	scopes: Map<string, boolean>
) =>
	intersections
		.filter(
			(link) =>
				!link.isDeleted &&
				link.kind === 'belongs_to' &&
				link.fromId === traceId &&
				scopes.get(link.toId)
		)
		.map((link) => link.toId);

const copyFields = (
	trace: Trace,
	placement: {
		aboutKind: Trace['aboutKind'];
		aboutTime: Trace['aboutTime'];
		statedDuration: Trace['statedDuration'];
	},
	zone: string
) => ({
	title: trace.content,
	description: trace.description,
	relation: 'intend' as const,
	timezone: zone,
	...placement,
	aboutTraceId: null
});

type PreparedTraceCopy = {
	source: Trace;
	fields: ReturnType<typeof copyFields>;
	scopeIds: string[];
};
type PreparedCopyTree = {
	traces: PreparedTraceCopy[];
	links: { fromSourceId: string; toTraceId: string }[];
};

const prepareCopyTree = async (
	transaction: Transaction,
	root: Trace,
	allTraces: Trace[],
	intersections: ReturnType<typeof normalizeIntersection>[],
	copyDay: string,
	zone: string
): Promise<PreparedCopyTree | { refusal: RepeatFailure }> => {
	const activeTraces = new Map(
		allTraces.filter((trace) => !trace.isDeleted).map((trace) => [trace.id, trace])
	);
	const children = new Map<string, string[]>();
	const activePartLinks = intersections.filter(
		(link) => !link.isDeleted && link.kind === 'part_of'
	);
	for (const link of activePartLinks) {
		if (!activeTraces.has(link.fromId) || !activeTraces.has(link.toId)) continue;
		const list = children.get(link.toId) ?? [];
		list.push(link.fromId);
		children.set(link.toId, list);
	}
	const descendantIds: string[] = [];
	const seen = new Set([root.id]);
	const pending = [root.id];
	while (pending.length) {
		const parentId = pending.shift()!;
		for (const childId of children.get(parentId) ?? []) {
			if (seen.has(childId)) continue;
			const trace = activeTraces.get(childId)!;
			if (!isIntentionRelation(trace.relation)) continue;
			seen.add(childId);
			pending.push(childId);
			descendantIds.push(childId);
		}
	}
	const copiedSourceIds = new Set([root.id, ...descendantIds]);
	const sourceById = new Map(
		[root, ...descendantIds.map((id) => activeTraces.get(id)!)].map((trace) => [trace.id, trace])
	);
	const scopes = new Map(
		(await transaction.fetch('scopes')).map((row) => [row.id, row.isDeleted !== true])
	);
	const sourceOrder = [root.id, ...descendantIds];
	const prepared: PreparedTraceCopy[] = [];
	for (const sourceId of sourceOrder) {
		const source = sourceById.get(sourceId)!;
		const target =
			sourceId === root.id
				? { kind: 'day' as const, dayKey: copyDay }
				: { kind: 'undated' as const };
		const placement = planPlacement(source, target, zone);
		if (!placement.ok) return { refusal: 'invalid_target' };
		prepared.push({
			source,
			fields: copyFields(source, placement.fields, zone),
			scopeIds: activeScopes(source.id, intersections, scopes)
		});
	}
	const rootParents = activePartLinks.filter(
		(link) => link.fromId === root.id && activeTraces.has(link.toId)
	);
	const copiedEdges = activePartLinks.filter(
		(link) => copiedSourceIds.has(link.fromId) && copiedSourceIds.has(link.toId)
	);
	return {
		traces: prepared,
		links: [...rootParents, ...copiedEdges].map((link) => ({
			fromSourceId: link.fromId,
			toTraceId: link.toId
		}))
	};
};

const copyTree = async (
	transaction: Transaction,
	prepared: PreparedCopyTree,
	operation: Operation,
	actor: LogActor
): Promise<string> => {
	const copies = new Map<string, string>();
	for (const entry of prepared.traces) {
		const copy = await saveTraceRecordInTransaction(
			transaction,
			{
				fields: { ...entry.fields, capturedAt: operation.timestamp },
				memberships: { add: entry.scopeIds }
			},
			actor,
			operation
		);
		copies.set(entry.source.id, copy.trace.id);
	}
	for (const link of prepared.links) {
		const fromId = copies.get(link.fromSourceId);
		const toId = copies.get(link.toTraceId) ?? link.toTraceId;
		if (!fromId) throw new Error('Prepared copy tree lost a source Trace.');
		await createIntersectionInTransaction(
			transaction,
			{ fromId, toId, kind: 'part_of' },
			actor,
			operation
		);
	}
	return copies.get(prepared.traces[0].source.id)!;
};

const repeatInTransaction = async (
	transaction: Transaction,
	intentionId: string,
	outcome: RepeatOutcome,
	text: string,
	copyDay: string,
	{ now, zone }: RepeatOptions,
	actor: LogActor
): Promise<RepeatResult> => {
	const operation = newOperation();
	const state = await sourceState(transaction, intentionId);
	if (state.refusal) return refuse(state.refusal);
	if (state.trace.kindId !== null) return refuse('typed_unsupported');
	if (state.result.open.value === false) return refuse('closed');
	const instant = new Date(now).toISOString();
	if (laterEvidence(state.result, instant)) return refuse('later_result_exists');
	const title = text.trim();
	if (outcome !== 'completed' && !title) return refuse('text_required');
	try {
		repeatDays(now, zone);
	} catch {
		return refuse('invalid_target');
	}
	const prepared = await prepareCopyTree(
		transaction,
		state.trace,
		state.traces,
		state.intersections,
		copyDay,
		zone
	);
	if ('refusal' in prepared) return refuse(prepared.refusal);
	const scopes = new Map(
		(await transaction.fetch('scopes')).map((row) => [row.id, row.isDeleted !== true])
	);
	const fact = await saveTraceRecordInTransaction(
		transaction,
		{
			fields: {
				title: outcome === 'completed' ? state.trace.content : title,
				relation: 'actual',
				capturedAt: instant,
				timezone: zone,
				aboutKind: 'instant',
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: instant,
					end: null
				}
			},
			memberships: { add: activeScopes(intentionId, state.intersections, scopes) },
			links: {
				add: [
					{
						kind: 'evidence_for',
						intentionId,
						assessment: { outcome, open: false }
					}
				]
			}
		},
		actor,
		operation
	);
	const createdCopyId = await copyTree(transaction, prepared, operation, actor);
	return {
		ok: true,
		operationId: operation.id,
		factId: fact.trace.id,
		copyId: createdCopyId,
		copyDay
	};
};

export const createRepeatIntentionRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'repeatIntention'> => ({
	repeatIntention: async (intentionId, outcome, text, target, options) => {
		await client.ready?.();
		return client.transact((transaction) =>
			repeatInTransaction(transaction, intentionId, outcome, text, target, options, 'user')
		);
	}
});

export { repeatDays } from './targets';
export type { RepeatFailure, RepeatOptions, RepeatOutcome, RepeatResult } from './types';
