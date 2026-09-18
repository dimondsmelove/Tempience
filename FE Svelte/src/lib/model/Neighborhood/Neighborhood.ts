import { traceMarkTime } from '$lib/model/Projection/marks';
import { scopeMembership } from '$lib/model/Projection/tree';
import type { MarkTime } from '$lib/model/Projection/types';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import { DAY_MS, DEFAULT_NEIGHBORHOOD_OPTIONS } from './constants';
import type {
	Neighbor,
	NeighborLinkKind,
	NeighborReason,
	Neighborhood,
	NeighborhoodOptions
} from './types';

type Link = Readonly<{
	/** Intersection id for persisted links; null for links a record carries itself. */
	id: string | null;
	fromId: string;
	toId: string;
	kind: NeighborLinkKind;
}>;
type Candidate = Readonly<{ trace: ExplorerTrace; time: MarkTime }>;

/** Record-to-record links: persisted intersections, `trace_ref` and relative-time anchors. */
export const traceLinks = (snapshot: ExplorerSnapshot): Link[] => {
	const traceIds = new Set(snapshot.traces.map((trace) => trace.id));
	const links: Link[] = snapshot.intersections
		.filter((link) => traceIds.has(link.fromId) && traceIds.has(link.toId))
		.map((link) => ({ id: link.id, fromId: link.fromId, toId: link.toId, kind: link.kind }));
	for (const trace of snapshot.traces) {
		if (trace.aboutKind === 'trace_ref' && trace.aboutTraceId)
			links.push({ id: null, fromId: trace.id, toId: trace.aboutTraceId, kind: 'trace_ref' });
		if (trace.aboutTime?.basis === 'relative')
			links.push({
				id: null,
				fromId: trace.id,
				toId: trace.aboutTime.anchorTraceId,
				kind: 'temporal_anchor'
			});
	}
	return links;
};

const dayKey = (t: number): number => {
	const date = new Date(t);
	return date.getFullYear() * 10_000 + date.getMonth() * 100 + date.getDate();
};

/**
 * A one-off, explainable neighbourhood around a record: up to `radius` records
 * on each side by time within the anchor's Scopes (or all Scopes), every one
 * with its reasons, plus explicit links that fall outside that window.
 * Nothing is stored; the caller re-anchors by asking again (DESIGN.md §8, DP14).
 */
export const neighborhood = (
	snapshot: ExplorerSnapshot,
	anchorId: string,
	options: NeighborhoodOptions = DEFAULT_NEIGHBORHOOD_OPTIONS
): Neighborhood | null => {
	const tracesById = new Map(snapshot.traces.map((trace) => [trace.id, trace]));
	const anchor = tracesById.get(anchorId);
	if (!anchor) return null;
	const membership = scopeMembership(snapshot.traces, snapshot.scopes, snapshot.intersections);
	const scopesOf = (traceId: string): string[] => [
		...(membership.scopesByTrace.get(traceId) ?? [])
	];
	const anchorScopeIds = scopesOf(anchorId);
	const anchorTime = traceMarkTime(anchor);

	const linkReasons = new Map<string, NeighborReason[]>();
	for (const link of traceLinks(snapshot)) {
		if (link.fromId !== anchorId && link.toId !== anchorId) continue;
		const other = link.fromId === anchorId ? link.toId : link.fromId;
		if (other === anchorId || !tracesById.has(other)) continue;
		const reasons = linkReasons.get(other) ?? [];
		reasons.push({
			kind: 'link',
			link: link.kind,
			direction: link.fromId === anchorId ? 'outgoing' : 'incoming'
		});
		linkReasons.set(other, reasons);
	}

	const neighbor = (trace: ExplorerTrace, time: MarkTime | null): Neighbor => {
		const scopeIds = scopesOf(trace.id);
		const reasons: NeighborReason[] = [...(linkReasons.get(trace.id) ?? [])];
		if (anchorTime && time) {
			if (dayKey(anchorTime.start) === dayKey(time.start)) reasons.push({ kind: 'sameDay' });
			else
				reasons.push({
					kind: 'distance',
					days: Math.round(Math.abs(time.start - anchorTime.start) / DAY_MS)
				});
		}
		const shared = scopeIds.filter((scopeId) => anchorScopeIds.includes(scopeId));
		if (shared.length) reasons.push({ kind: 'sharedScope', scopeIds: shared });
		if (trace.origin.sourceId === anchor.origin.sourceId)
			reasons.push({ kind: 'sharedSource', sourceId: anchor.origin.sourceId });
		return { traceId: trace.id, label: trace.content, time, scopeIds, reasons };
	};

	let before: Neighbor[] = [];
	let after: Neighbor[] = [];
	if (anchorTime) {
		const inScope = (traceId: string): boolean =>
			options.filter === 'all' ||
			anchorScopeIds.length === 0 ||
			scopesOf(traceId).some((scopeId) => anchorScopeIds.includes(scopeId));
		const candidates: Candidate[] = [];
		for (const trace of snapshot.traces) {
			if (trace.id === anchorId || !inScope(trace.id)) continue;
			const time = traceMarkTime(trace);
			if (time) candidates.push({ trace, time });
		}
		candidates.sort((a, b) => a.time.start - b.time.start || a.trace.id.localeCompare(b.trace.id));
		const isBefore = ({ trace, time }: Candidate): boolean =>
			time.start < anchorTime.start ||
			(time.start === anchorTime.start && trace.id.localeCompare(anchorId) < 0);
		before = candidates
			.filter(isBefore)
			.slice(-options.radius)
			.map((candidate) => neighbor(candidate.trace, candidate.time));
		after = candidates
			.filter((candidate) => !isBefore(candidate))
			.slice(0, options.radius)
			.map((candidate) => neighbor(candidate.trace, candidate.time));
	}
	const shown = new Set([...before, ...after].map((item) => item.traceId));
	const linked = [...linkReasons.keys()]
		.filter((traceId) => !shown.has(traceId))
		.map((traceId) => tracesById.get(traceId)!)
		.map((trace) => neighbor(trace, traceMarkTime(trace)));

	return { anchorId, anchorTime, anchorScopeIds, before, after, linked };
};
