import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import { isSupplementMarker } from '$lib/state/triplit/Traces/supplement';
import { translate } from '$lib/state/Locale/messages';
import {
	KIND_ROWS,
	TRACE_LINK_KINDS,
	UNSCOPED_ROW_ID,
	UNSCOPED_ROW_KEY,
	INTENT_GLYPHS,
	CLOSED_INTENT_GLYPH
} from './constants';
import { parkedReason, traceMarkTime, traceTimeLabel } from './marks';
import { ancestorsOf, scopeMembership, scopeTree, subtreeTraceIds } from './tree';
import type {
	Mark,
	MarkTime,
	ParkedTrace,
	ProjectedRow,
	Projection,
	ProjectionState,
	TimeRange,
	TraceLink
} from './types';

const rangeOf = (marks: readonly Mark[]): TimeRange | null => {
	if (marks.length === 0) return null;
	let start = Infinity,
		end = -Infinity;
	for (const mark of marks) {
		if (mark.start < start) start = mark.start;
		if (mark.end > end) end = mark.end;
	}
	return { start, end };
};

/** Scopes kept by «Только эти Scope»: the chosen ones, their ancestors and their descendants. */
const onlyAllowed = (
	only: ReadonlySet<string>,
	children: ReadonlyMap<string, readonly string[]>,
	tree: Parameters<typeof ancestorsOf>[0]
): Set<string> => {
	const allowed = new Set<string>();
	const descend = (scopeId: string): void => {
		if (allowed.has(scopeId)) return;
		allowed.add(scopeId);
		for (const childId of children.get(scopeId) ?? []) descend(childId);
	};
	for (const scopeId of only) {
		for (const ancestorId of ancestorsOf(tree, scopeId)) allowed.add(ancestorId);
		descend(scopeId);
	}
	return allowed;
};

/** A closed intention carries its outcome glyph in front of its name; everything else is named as is. */
export const captionOf = (trace: ExplorerTrace): string => {
	const title = trace.displayTitle ?? trace.content;
	if (trace.intentOpen !== false) return title;
	const glyph = trace.intentOutcome ? INTENT_GLYPHS[trace.intentOutcome] : CLOSED_INTENT_GLYPH;
	return `${glyph} ${title}`;
};

/**
 * Rows and marks of the ribbon from a snapshot and the workbench state
 * (DESIGN.md §4, §5, DP8). Pure: the same input always gives the same rows,
 * so the canvas can key its redraw on the result.
 */
export const projectSnapshot = (snapshot: ExplorerSnapshot, state: ProjectionState): Projection => {
	const traces = snapshot.traces.filter(
		(trace) => !trace.kindId || Boolean(state.shownKindIds?.has(trace.kindId))
	);
	const traceById = new Map(traces.map((trace) => [trace.id, trace]));
	const timeByTraceId = new Map<string, MarkTime>();
	for (const trace of traces) {
		const time = traceMarkTime(trace);
		if (time) timeByTraceId.set(trace.id, time);
	}

	const tree = scopeTree(snapshot.scopes, snapshot.intersections);
	const membership = scopeMembership(traces, snapshot.scopes, snapshot.intersections);
	const allowed = state.onlyScopes ? onlyAllowed(state.onlyScopes, tree.children, tree) : null;
	const blocked = new Set<string>();
	const hide = (id: string): void => {
		if (blocked.has(id)) return;
		blocked.add(id);
		for (const childId of tree.children.get(id) ?? []) hide(childId);
	};
	for (const id of state.hiddenScopes) hide(id);
	if (allowed)
		for (const scope of snapshot.scopes) if (!allowed.has(scope.id)) blocked.add(scope.id);

	const query = state.scopeQuery.trim().toLocaleLowerCase();
	const matched = snapshot.scopes.filter(
		(scope) => !blocked.has(scope.id) && scope.name.toLocaleLowerCase().includes(query)
	);
	const searched = new Set<string>();
	const descend = (id: string): void => {
		if (searched.has(id) || blocked.has(id)) return;
		searched.add(id);
		for (const childId of tree.children.get(id) ?? []) descend(childId);
	};
	for (const scope of matched) descend(scope.id);
	const expanded = new Set(state.expanded);
	const paths = new Set(searched);
	if (query)
		for (const scopeId of searched)
			for (const id of ancestorsOf(tree, scopeId)) {
				paths.add(id);
				expanded.add(id);
			}
	for (const scope of snapshot.scopes) if (!paths.has(scope.id)) blocked.add(scope.id);
	const directByScope = new Map(
		[...membership.directByScope].filter(([scopeId]) => searched.has(scopeId))
	);
	const subtree = subtreeTraceIds(tree, { ...membership, directByScope }, blocked);
	const included = (trace: ExplorerTrace): boolean => {
		const scopeIds = membership.scopesByTrace.get(trace.id);
		return scopeIds?.size ? [...scopeIds].some((id) => searched.has(id)) : !query;
	};
	const hidden = state.hiddenLegend;
	const proposals = state.proposals ?? new Map<string, string>();

	const mark = (trace: ExplorerTrace, time: MarkTime, rowId: string, rollup: boolean): Mark => ({
		...time,
		id: `${trace.id}@${rowId}`,
		traceId: trace.id,
		rowId,
		rollup,
		proposal: proposals.has(trace.id),
		...(trace.intentOpen === false ? { closed: true } : {}),
		label: captionOf(trace),
		timeLabel: traceTimeLabel(trace, state.language ?? 'ru')
	});
	const keep = (item: Mark): boolean =>
		!hidden.has(item.kind) &&
		!(hidden.has('intent') && item.intent) &&
		!(hidden.has('rollup') && item.rollup) &&
		!(hidden.has('proposal') && item.proposal);

	const rows: ProjectedRow[] = [];
	const scopeById = new Map(snapshot.scopes.map((scope) => [scope.id, scope]));
	// A Scope without records is a row too (ANSWERS Q9): what was made stays in sight.
	const liveChildren = (scopeId: string): string[] =>
		(tree.children.get(scopeId) ?? []).filter((childId) => !blocked.has(childId));
	/** A record counts for a row when it stands on the ribbon there: timed, and not hidden by the legend. */
	const onRibbon = (traceId: string, rowId: string): boolean => {
		const trace = traceById.get(traceId);
		const time = timeByTraceId.get(traceId);
		return Boolean(trace && time && keep(mark(trace, time, rowId, false)));
	};
	const visit = (scopeId: string, depth: number): void => {
		const scope = scopeById.get(scopeId);
		if (!scope || blocked.has(scopeId)) return;
		const all = subtree.get(scopeId) ?? new Set<string>();
		const direct = directByScope.get(scopeId) ?? new Set<string>();
		const children = liveChildren(scopeId);
		const isExpanded = children.length > 0 && expanded.has(scopeId);
		const marks: Mark[] = [];
		for (const traceId of all) {
			const isDirect = direct.has(traceId);
			if (!isDirect && (isExpanded || children.length === 0)) continue;
			const trace = traceById.get(traceId);
			const time = timeByTraceId.get(traceId);
			if (trace && time) marks.push(mark(trace, time, scopeId, !isDirect));
		}
		rows.push({
			id: scopeId,
			kind: 'scope',
			scopeId,
			name: scope.name,
			depth,
			hasChildren: children.length > 0,
			expanded: isExpanded,
			// Owner 2026-09-15: the numbers say what the ribbon shows, not what the Scope holds.
			directCount: [...direct].filter((id) => onRibbon(id, scopeId)).length,
			subtreeCount: [...all].filter((id) => onRibbon(id, scopeId)).length,
			range: rangeOf(marks),
			marks: marks.filter(keep)
		});
		if (isExpanded) for (const childId of children) visit(childId, depth + 1);
	};
	if (state.grouping === 'scope') for (const rootId of tree.roots) visit(rootId, 0);

	const unscoped = traces.filter(
		(trace) => !query && (membership.scopesByTrace.get(trace.id)?.size ?? 0) === 0
	);
	// «Только эти Scope» is about Scopes: records in none are out of it (owner, 2026-09-18).
	if (state.grouping === 'scope' && unscoped.length > 0 && !state.onlyScopes) {
		const marks: Mark[] = [];
		for (const trace of unscoped) {
			const time = timeByTraceId.get(trace.id);
			if (time) marks.push(mark(trace, time, UNSCOPED_ROW_ID, false));
		}
		rows.push({
			id: UNSCOPED_ROW_ID,
			kind: 'unscoped',
			scopeId: null,
			name: translate(state.language ?? 'ru', UNSCOPED_ROW_KEY),
			depth: 0,
			hasChildren: false,
			expanded: false,
			directCount: marks.filter(keep).length,
			subtreeCount: marks.filter(keep).length,
			range: rangeOf(marks),
			marks: marks.filter(keep)
		});
	}

	if (state.grouping === 'kind')
		for (const { kind, name: nameKey } of KIND_ROWS) {
			const name = translate(state.language ?? 'ru', nameKey);
			const rowId = `__kind_${kind}__`;
			const marks: Mark[] = [];
			for (const trace of traces) {
				const time = timeByTraceId.get(trace.id);
				if (time?.kind === kind && included(trace)) marks.push(mark(trace, time, rowId, false));
			}
			if (marks.length === 0) continue;
			rows.push({
				id: rowId,
				kind,
				scopeId: null,
				name,
				depth: 0,
				hasChildren: false,
				expanded: false,
				directCount: marks.length,
				subtreeCount: marks.length,
				range: null,
				marks: marks.filter(keep)
			});
		}

	const marksByTraceId = new Map<string, Mark[]>();
	for (const row of rows)
		for (const item of row.marks)
			(marksByTraceId.get(item.traceId) ??
				marksByTraceId.set(item.traceId, []).get(item.traceId))!.push(item);

	// A new supplement (revisits marker) is reached through its original's Context, not parked;
	// legacy inline trace_ref records keep their parked entry.
	const parked: ParkedTrace[] = traces
		.filter(
			(trace) => !timeByTraceId.has(trace.id) && included(trace) && !isSupplementMarker(trace)
		)
		.map((trace) => ({
			traceId: trace.id,
			label: captionOf(trace),
			...(trace.intentOpen === false ? { closed: true } : {}),
			reason: parkedReason(trace),
			scopeIds: [...(membership.scopesByTrace.get(trace.id) ?? [])]
		}));

	const links: TraceLink[] = snapshot.intersections
		.filter(
			(link) =>
				TRACE_LINK_KINDS.includes(link.kind) &&
				traceById.has(link.fromId) &&
				traceById.has(link.toId)
		)
		.map((link) => ({ fromTraceId: link.fromId, toTraceId: link.toId, kind: link.kind }));

	let intents = 0;
	for (const time of timeByTraceId.values()) if (time.intent) intents += 1;

	return {
		rows,
		parked,
		counts: {
			rows: rows.length,
			onAxis: timeByTraceId.size,
			intents,
			proposals: [...proposals.values()].filter((decision) => decision === 'pending').length,
			parked: parked.length
		},
		extent: rangeOf([...timeByTraceId.values()] as Mark[]),
		marksByTraceId,
		timeByTraceId,
		links
	};
};

/** Distinct records whose marks touch the window in the projected rows. */
export const countInWindow = (projection: Projection, window: TimeRange): number => {
	let count = 0;
	for (const [, marks] of projection.marksByTraceId) {
		if (marks.some((item) => item.start < window.end && item.end >= window.start)) count += 1;
	}
	return count;
};

/** The whole time of a record as the ribbon shows it: used for revealing and fitting. */
export const traceRange = (projection: Projection, traceId: string): TimeRange | null => {
	const time = projection.timeByTraceId.get(traceId);
	return time ? { start: time.start, end: time.end } : null;
};
