import type {
	ExplorerIntersection,
	ExplorerScope,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';
import { mergeExplorerSnapshots } from '$lib/model/Snapshot/Snapshot';

export const EXPLORER_CONFORMANCE_FIXTURE_ID = 'explorer-conformance-v1';

export const EXPLORER_CONFORMANCE_IDS = {
	scope: 'fixture:explorer:scope:conformance',
	wholeA: 'fixture:explorer:trace:whole-a',
	wholeB: 'fixture:explorer:trace:whole-b',
	directPart: 'fixture:explorer:trace:direct-part',
	nestedPart: 'fixture:explorer:trace:nested-part',
	sharedPart: 'fixture:explorer:trace:shared-part',
	intent: 'fixture:explorer:trace:intent',
	evidence: 'fixture:explorer:trace:evidence',
	previous: 'fixture:explorer:trace:previous',
	revisit: 'fixture:explorer:trace:revisit',
	referenceTarget: 'fixture:explorer:trace:reference-target',
	reference: 'fixture:explorer:trace:reference'
} as const;

const origin = {
	kind: 'synthetic-conformance' as const,
	sourceId: EXPLORER_CONFORMANCE_FIXTURE_ID
};

const temporalTrace = (
	id: string,
	content: string,
	day: string,
	relation: 'actual' | 'intend' = 'actual'
): ExplorerTrace => ({
	id,
	content: `[Synthetic coverage] ${content}`,
	relation,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: day,
		end: null
	},
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin
});

const traceReference = (id: string, targetId: string): ExplorerTrace => ({
	id,
	content: '[Synthetic coverage] Trace reference',
	relation: 'actual',
	timezone: 'UTC',
	aboutKind: 'trace_ref',
	aboutTime: null,
	aboutTraceId: targetId,
	kindId: null,
	kindVId: null,
	data: null,
	origin
});

const relation = (
	id: string,
	fromId: string,
	toId: string,
	kind: ExplorerIntersection['kind']
): ExplorerIntersection => ({ id, fromId, toId, kind, context: null, origin });

export const createExplorerConformanceSnapshot = (): ExplorerSnapshot => {
	const ids = EXPLORER_CONFORMANCE_IDS;
	const scope: ExplorerScope = {
		id: ids.scope,
		name: '[Synthetic coverage] Conformance',
		note: 'Synthetic Explorer data-shape coverage; not user biography.',
		startedAt: null,
		endedAt: null,
		colorHue: null,
		colorChroma: null,
		origin
	};
	const traces = [
		temporalTrace(ids.wholeA, 'Whole A', '2026-01-01'),
		temporalTrace(ids.wholeB, 'Whole B', '2026-01-02'),
		temporalTrace(ids.directPart, 'Direct part', '2026-01-03'),
		temporalTrace(ids.nestedPart, 'Nested part', '2026-01-04'),
		temporalTrace(ids.sharedPart, 'Shared part', '2026-01-05'),
		temporalTrace(ids.intent, 'Intent', '2026-01-06', 'intend'),
		temporalTrace(ids.evidence, 'Evidence actual', '2026-01-07'),
		temporalTrace(ids.previous, 'Previous Trace', '2026-01-08'),
		temporalTrace(ids.revisit, 'Revisiting Trace', '2026-01-09'),
		temporalTrace(ids.referenceTarget, 'Reference target', '2026-01-10'),
		traceReference(ids.reference, ids.referenceTarget)
	];
	const memberships = traces.map((trace) =>
		relation(
			`fixture:explorer:intersection:membership:${trace.id}`,
			trace.id,
			scope.id,
			'belongs_to'
		)
	);
	const intersections = [
		...memberships,
		relation('fixture:explorer:intersection:part-direct', ids.directPart, ids.wholeA, 'part_of'),
		relation(
			'fixture:explorer:intersection:part-nested',
			ids.nestedPart,
			ids.directPart,
			'part_of'
		),
		relation('fixture:explorer:intersection:part-shared-a', ids.sharedPart, ids.wholeA, 'part_of'),
		relation('fixture:explorer:intersection:part-shared-b', ids.sharedPart, ids.wholeB, 'part_of'),
		relation('fixture:explorer:intersection:evidence', ids.evidence, ids.intent, 'evidence_for'),
		relation('fixture:explorer:intersection:revisit', ids.revisit, ids.previous, 'revisits')
	];

	return {
		traces,
		scopes: [scope],
		periods: [],
		intersections,
		scopeSegments: []
	};
};

export const withExplorerConformanceCoverage = (snapshot: ExplorerSnapshot): ExplorerSnapshot =>
	mergeExplorerSnapshots(snapshot, createExplorerConformanceSnapshot());
