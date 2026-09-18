import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
import { dayTime, plainDraft, plainFields } from '$lib/state/triplit/Traces/record.fixture';
import type { Intersection, Trace, TraceAboutTime } from '$lib/state/triplit/types';
import type { DraftFixture } from './TraceDraft.fixture';

/** A stored Trace row as the picker and the target states read it, without a repository. */
export const plainTrace = (
	id: string,
	content: string,
	relation: 'intend' | 'actual',
	aboutTime: TraceAboutTime = { basis: 'unknown' },
	patch: Partial<Trace> = {}
): Trace => ({
	id,
	...plainDraft(content, relation, aboutTime),
	relation,
	description: null,
	aboutAt: null,
	aboutStart: null,
	aboutEnd: null,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	isDeleted: false,
	lifecycleId: null,
	createdAt: '2026-09-13T08:00:00.000Z',
	updatedAt: '2026-09-13T08:00:00.000Z',
	...patch
});

/** An intention without a date, the ordinary plan of these tests; optionally in Scopes. */
export const intentionOf = async (
	fx: DraftFixture,
	title: string,
	scopeIds: readonly string[] = []
): Promise<Trace> => {
	const trace = await fx.repository.createTrace(plainDraft(title, 'intend', { basis: 'unknown' }));
	for (const scopeId of scopeIds) {
		await fx.repository.createIntersection({ fromId: trace.id, toId: scopeId, kind: 'belongs_to' });
	}
	return trace;
};

/** A dated fact saved through the record command, linked as a result with a statement. */
export const factFor = async (
	fx: DraftFixture,
	title: string,
	intentionId: string,
	assessment?: { outcome?: 'completed' | 'partial' | null; open?: boolean | null },
	day = '2026-09-11'
) =>
	fx.repository.saveTraceRecord({
		fields: plainFields(title, { aboutTime: dayTime(day) }),
		links: {
			add: [{ kind: 'evidence_for', intentionId, ...(assessment ? { assessment } : {}) }]
		}
	});

/** The intention's current derived state from the persisted rows. */
export const stateOf = async (fx: DraftFixture, intentionId: string) => {
	const traces = await fx.repository.listTraces(true);
	const intersections = await fx.repository.listIntersections(true);
	const assessments = await fx.repository.listIntentionAssessments(true);
	const result = evaluateIntention(intentionId, assessments, {
		tracesById: new Map(traces.map((trace) => [trace.id, trace])),
		intersectionsById: new Map(intersections.map((link) => [link.id, link]))
	});
	return {
		outcome: result.outcome.value,
		open: result.open.value,
		sourceId: result.outcome.sourceId
	};
};

/** Active evidence links from a fact, as [intentionId, isDeleted]. */
export const evidenceOf = async (
	fx: DraftFixture,
	factId: string,
	includeDeleted = false
): Promise<(readonly [string, boolean])[]> =>
	(await fx.repository.listIntersections(includeDeleted))
		.filter((link: Intersection) => link.kind === 'evidence_for' && link.fromId === factId)
		.map((link) => [link.toId, link.isDeleted] as const)
		.toSorted((left, right) => left[0].localeCompare(right[0]));

/** Every assessment row, deleted ones included, as the essentials. */
export const assessmentsOf = async (
	fx: DraftFixture
): Promise<
	Pick<IntentionAssessment, 'id' | 'source' | 'intentionId' | 'outcome' | 'open' | 'isDeleted'>[]
> =>
	(await fx.repository.listIntentionAssessments(true)).map(
		({ id, source, intentionId, outcome, open, isDeleted }) => ({
			id,
			source,
			intentionId,
			outcome,
			open,
			isDeleted
		})
	);
