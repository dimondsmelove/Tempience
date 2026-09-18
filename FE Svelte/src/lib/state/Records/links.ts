import { locale } from '$lib/state/Locale/Locale.svelte';
import { traceSummary, type KindCatalog } from '$lib/model/TraceForm/summary';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
import { isSupplementMarker, supplementState } from '$lib/state/triplit/Traces/supplement';
import type { Intersection, Scope, Trace, TraceIntersectionKind } from '$lib/state/triplit/types';
import { intentionResultView } from './result';
import type { EndpointState, LinkedRecord, LinkedRecords, Membership } from './types';

/** Every row the reader needs: links and records are read once, deleted rows included. */
export type RecordRows = Readonly<{
	traces: readonly Trace[];
	intersections: readonly Intersection[];
	assessments: readonly IntentionAssessment[];
	scopes: readonly Scope[];
	catalog: KindCatalog;
}>;

/** The explicit record-to-record kinds a Context lists; Scope membership is not one. */
const TRACE_LINK_KINDS: readonly TraceIntersectionKind[] = [
	'part_of',
	'evidence_for',
	'revisits',
	'related_to'
];

const endpointState = (trace: Trace | null): EndpointState =>
	trace === null ? 'unavailable' : trace.isDeleted ? 'deleted' : 'active';

const rowFor = (
	traceId: string,
	link: Pick<Intersection, 'id' | 'fromId' | 'toId' | 'kind'>,
	kind: LinkedRecord['kind'],
	byId: ReadonlyMap<string, Trace>,
	catalog: KindCatalog
): LinkedRecord => {
	const outgoing = link.fromId === traceId;
	const otherId = outgoing ? link.toId : link.fromId;
	const trace = byId.get(otherId) ?? null;
	return {
		linkId: link.id,
		kind,
		direction: outgoing ? 'outgoing' : 'incoming',
		otherId,
		state: endpointState(trace),
		trace,
		summary: trace ? traceSummary(trace, catalog, locale.current) : null
	};
};

/**
 * The links of one record as its Context lists them: every active stored link, whatever
 * became of the record at the other end, plus the references the record's own fields carry.
 * A link to a deleted or missing record is a row of its own — it is never silently dropped,
 * and no deleted record is added to the active timeline by being named here.
 */
export const linkedRecords = (traceId: string, rows: RecordRows): LinkedRecords => {
	const byId = new Map(rows.traces.map((trace) => [trace.id, trace] as const));
	const trace = byId.get(traceId) ?? null;
	const active = rows.intersections.filter(
		(link): link is Intersection & { kind: TraceIntersectionKind } =>
			!link.isDeleted &&
			link.fromEntityType !== 'traceKind' &&
			TRACE_LINK_KINDS.includes(link.kind as TraceIntersectionKind) &&
			(link.fromId === traceId || link.toId === traceId)
	);
	const links: LinkedRecord[] = active.map((link) =>
		rowFor(traceId, link, link.kind, byId, rows.catalog)
	);
	// References the record itself carries: a legacy inline address and a relative anchor.
	if (trace?.aboutKind === 'trace_ref' && trace.aboutTraceId) {
		links.push(
			rowFor(
				traceId,
				{ id: '', fromId: traceId, toId: trace.aboutTraceId, kind: 'related_to' },
				'trace_ref',
				byId,
				rows.catalog
			)
		);
	}
	if (trace?.aboutTime?.basis === 'relative') {
		links.push(
			rowFor(
				traceId,
				{ id: '', fromId: traceId, toId: trace.aboutTime.anchorTraceId, kind: 'related_to' },
				'temporal_anchor',
				byId,
				rows.catalog
			)
		);
	}
	const revisits = active.filter((link) => link.kind === 'revisits' && link.fromId === traceId);
	const withdrawn = rows.intersections.filter(
		(link): link is Intersection & { kind: TraceIntersectionKind } =>
			link.isDeleted === true &&
			link.fromEntityType !== 'traceKind' &&
			TRACE_LINK_KINDS.includes(link.kind as TraceIntersectionKind) &&
			(link.fromId === traceId || link.toId === traceId)
	);
	const scopesById = new Map(rows.scopes.map((scope) => [scope.id, scope] as const));
	const memberships: Membership[] = rows.intersections
		.filter((link) => link.kind === 'belongs_to' && link.fromId === traceId)
		.map((link) => ({
			linkId: link.id,
			scopeId: link.toId,
			name: scopesById.get(link.toId)?.name ?? null,
			active: !link.isDeleted
		}));
	return {
		traceId,
		trace,
		summary: trace ? traceSummary(trace, rows.catalog, locale.current) : null,
		memberships,
		links: links.map((link) => (link.linkId === '' ? { ...link, linkId: null } : link)),
		supplement:
			trace && isSupplementMarker(trace)
				? supplementState(traceId, trace.relation, revisits, (id) => byId.has(id))
				: null,
		result: intentionResultView(traceId, rows),
		withdrawnLinks: withdrawn.map((link) => rowFor(traceId, link, link.kind, byId, rows.catalog)),
		// A statement that started here belongs to this record's history even after a correction
		// moved it to another intention — and so does one that only passed through: a correction
		// leaves the link it moved away from withdrawn, still naming the statement it carried, so
		// an intention that was a destination on the way keeps that part of its own history.
		pastSourceIds: [
			...new Set([
				...rows.assessments
					.filter(
						(assessment) =>
							assessment.originIntentionId === traceId || assessment.factId === traceId
					)
					.map((assessment) => assessment.id),
				...withdrawn.map((link) => link.assessmentId).filter((id): id is string => !!id)
			])
		]
	};
};

/**
 * The records a record's answer needs beside itself: the other ends of the links that touch
 * it, the facts of the statements addressed to it, and the records its own fields name. A
 * bounded read of the record reads exactly these, by id.
 */
export const neighbourIds = (
	traceId: string,
	trace: Trace | null,
	intersections: readonly Intersection[],
	assessments: readonly IntentionAssessment[]
): string[] => {
	const ids = new Set<string>();
	for (const link of intersections) {
		if (link.fromEntityType === 'traceKind') continue;
		if (link.fromId === traceId) ids.add(link.toId);
		if (link.toId === traceId) ids.add(link.fromId);
	}
	for (const assessment of assessments) {
		if (assessment.factId) ids.add(assessment.factId);
		ids.add(assessment.intentionId);
		ids.add(assessment.originIntentionId);
	}
	if (trace?.aboutKind === 'trace_ref' && trace.aboutTraceId) ids.add(trace.aboutTraceId);
	if (trace?.aboutTime?.basis === 'relative') ids.add(trace.aboutTime.anchorTraceId);
	ids.delete(traceId);
	return [...ids].toSorted();
};
