import type { VersionSummary } from '$lib/model/TraceForm/summary-fields';
import type { TempienceRepository, TraceRepository } from '$lib/state/triplit/repository';
import type { IntentionAssessment, Trace } from '$lib/state/triplit/types';
import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import type {
	ExplorerIntersection,
	ExplorerOrigin,
	ExplorerPeriod,
	ExplorerScope,
	ExplorerScopeSegment,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';

/**
 * One stored record as the timeline and the Context show it. The snapshot maps every record
 * this way once; the Context maps the selected record the same way from its live reader, so a
 * record that changed on another device is shown as it is now, in the same shape.
 */
export const explorerTraceOf = (trace: Trace, origin: ExplorerOrigin): ExplorerTrace => ({
	id: trace.id,
	content: trace.content,
	description: trace.description,
	relation: trace.relation,
	timezone: trace.timezone,
	aboutKind: trace.aboutKind,
	aboutTime: trace.aboutTime,
	...(trace.statedDuration ? { statedDuration: trace.statedDuration } : {}),
	aboutTraceId: trace.aboutTraceId,
	kindId: trace.kindId,
	kindVId: trace.kindVId,
	data: trace.data,
	origin
});

export type ExplorerRepositoryReader = Pick<
	TraceRepository,
	'listTraces' | 'listScopes' | 'listPeriods' | 'listIntersections' | 'listScopeSegments'
> &
	Partial<
		Pick<TempienceRepository, 'listTraceHeads' | 'listLinkHeads' | 'listIntentionAssessments'>
	>;

/** How a read of the snapshot is timed: a step's name and its run; by default not at all. */
export type SnapshotTimer = <T>(step: 'records' | 'links', run: () => Promise<T>) => Promise<T>;

const untimed: SnapshotTimer = (_, run) => run();

/**
 * The timeline's read of the space. Given the summary leaves of the Kind versions, the
 * records are read thin — every field a row needs, of the data only the leaves of the
 * record's own version — which is all the timeline shows; without them, or without a
 * repository that reads thin, whole rows. The links are read thin too — their ends, kind and
 * context — where the repository can.
 */
export const buildRepositoryExplorerSnapshot = async (
	repository: ExplorerRepositoryReader,
	sourceId: string,
	summaries?: readonly VersionSummary[],
	time: SnapshotTimer = untimed
): Promise<ExplorerSnapshot> => {
	const [traces, scopes, periods, intersections, scopeSegments] = await Promise.all([
		time('records', () =>
			summaries && repository.listTraceHeads
				? repository.listTraceHeads({ deleted: 'active', summaries })
				: repository.listTraces()
		),
		repository.listScopes(),
		repository.listPeriods(),
		time('links', () =>
			repository.listLinkHeads
				? repository.listLinkHeads({ deleted: 'active' })
				: repository.listIntersections()
		),
		repository.listScopeSegments()
	]);
	const origin = { kind: 'canonical' as const, sourceId };
	// Each intention's derived result, once, so the ribbon can tell a closed intention from an
	// open one (owner, 2026-09-15); a reader without assessments shows every intention open.
	const assessments: readonly IntentionAssessment[] = repository.listIntentionAssessments
		? await repository.listIntentionAssessments()
		: [];
	const results = new Map<string, { open: boolean; outcome: IntentionOutcome | null }>();
	if (assessments.length) {
		const tracesById = new Map(traces.map((trace) => [trace.id, trace] as const));
		const intersectionsById = new Map(intersections.map((link) => [link.id, link] as const));
		const byIntention = new Map<string, IntentionAssessment[]>();
		for (const assessment of assessments) {
			(byIntention.get(assessment.intentionId) ??
				byIntention.set(assessment.intentionId, []).get(assessment.intentionId))!.push(assessment);
		}
		for (const [intentionId, own] of byIntention) {
			const result = evaluateIntention(intentionId, own, { tracesById, intersectionsById });
			results.set(intentionId, { open: result.open.value, outcome: result.outcome.value });
		}
	}

	return {
		traces: traces.map((trace) => {
			const base = explorerTraceOf(trace, origin);
			const result = isIntentionRelation(trace.relation) ? results.get(trace.id) : undefined;
			return result ? { ...base, intentOpen: result.open, intentOutcome: result.outcome } : base;
		}),
		scopes: scopes.map((scope): ExplorerScope => ({
			id: scope.id,
			name: scope.name,
			note: scope.note,
			startedAt: scope.startedAt,
			endedAt: scope.endedAt,
			origin
		})),
		periods: periods.map((period): ExplorerPeriod => ({
			id: period.id,
			name: period.name,
			time: period.time,
			timezone: period.timezone,
			note: period.note,
			origin
		})),
		intersections: intersections
			.filter((intersection) => intersection.fromEntityType !== 'traceKind')
			.map((intersection): ExplorerIntersection => ({
				id: intersection.id,
				fromId: intersection.fromId,
				toId: intersection.toId,
				kind: intersection.kind,
				context: intersection.context,
				origin
			})),
		scopeSegments: scopeSegments.map((segment): ExplorerScopeSegment => ({
			id: segment.id,
			scopeId: segment.scopeId,
			startAt: segment.startAt,
			endAt: segment.endAt,
			label: segment.label,
			position: segment.position,
			origin
		}))
	};
};
