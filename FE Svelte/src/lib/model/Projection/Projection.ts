import { scopeColourKey, scopeColourPair, type ScopeColour } from '$lib/theme/scope-colour';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import { isSupplementMarker } from '$lib/state/triplit/Traces/supplement';
import { laneName, mergedRowId } from '$lib/model/Arrangement/Arrangement';
import type { RowLane } from '$lib/model/Arrangement/types';
import { monthsShort } from '$lib/model/Axis/constants';
import { legendFollows, legendKeysOf, legendShown } from '$lib/model/Legend/Legend';
import type { LegendKey } from '$lib/model/Legend/types';
import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import {
	KIND_ROWS,
	TRACE_LINK_KINDS,
	UNSCOPED_ROW_ID,
	UNSCOPED_ROW_KEY,
	INTENT_GLYPHS,
	CLOSED_INTENT_GLYPH,
	CLOSED_AT_GLYPH
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

/** The colour pairs of the Scopes that have one, in the given order — the row's dots. */
const scopeColoursOf = (
	scopes: readonly Readonly<{
		colorHue: number | null;
		colorChroma: number | null;
		colorDepth?: number | null;
	}>[]
): ScopeColour[] => scopes.flatMap((scope) => scopeColourPair(scope) ?? []);

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

/** The year an absolute time starts in, as its calendar value writes it; `null` for any other placement. */
const yearOf = (trace: Pick<ExplorerTrace, 'aboutTime'>): number | null =>
	trace.aboutTime?.basis === 'absolute' ? Number(trace.aboutTime.start.slice(0, 4)) : null;

/**
 * A closed intention carries its outcome glyph in front of its name; everything else is
 * named as is. Forced — selected, lit or matched (loop 008, C4) — a closed intention with a
 * known closing instant adds the closing day, «· ✓ 6 сен», in the axis month names of the
 * language; the year joins in when it differs from the intention's own.
 */
export const captionOf = (
	trace: ExplorerTrace,
	options: Readonly<{ forced?: boolean; language?: Locale }> = {}
): string => {
	const title = trace.displayTitle ?? trace.content;
	if (trace.intentOpen !== false) return title;
	const glyph = trace.intentOutcome ? INTENT_GLYPHS[trace.intentOutcome] : CLOSED_INTENT_GLYPH;
	const caption = `${glyph} ${title}`;
	const closedAt = options.forced && trace.intentClosedAt ? Date.parse(trace.intentClosedAt) : NaN;
	if (Number.isNaN(closedAt)) return caption;
	const at = new Date(closedAt);
	const year = at.getUTCFullYear();
	const day = `${at.getUTCDate()} ${monthsShort(options.language ?? 'ru')[at.getUTCMonth()]}`;
	return `${caption} · ${CLOSED_AT_GLYPH} ${yearOf(trace) === year ? day : `${day} ${year}`}`;
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
	// «Просроченное» and the reach of an open interval are decided at this build's «сейчас».
	const now = state.now ?? Date.now();
	const timeByTraceId = new Map<string, MarkTime>();
	for (const trace of traces) {
		const time = traceMarkTime(trace, now);
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
	const legendFilter = { soloLegend: state.soloLegend ?? null, hiddenLegend: state.hiddenLegend };
	const proposals = state.proposals ?? new Map<string, string>();

	const language = state.language ?? 'ru';
	/** The closing instant of a closed intention in epoch ms (C4), when the snapshot knows it. */
	const closedAtOf = (trace: ExplorerTrace): number | undefined => {
		if (trace.intentOpen !== false || !trace.intentClosedAt) return undefined;
		const at = Date.parse(trace.intentClosedAt);
		return Number.isNaN(at) ? undefined : at;
	};
	const mark = (trace: ExplorerTrace, time: MarkTime, rowId: string, rollup: boolean): Mark => {
		const label = captionOf(trace);
		const forcedLabel = captionOf(trace, { forced: true, language });
		const closedAt = closedAtOf(trace);
		return {
			...time,
			id: `${trace.id}@${rowId}`,
			traceId: trace.id,
			rowId,
			rollup,
			proposal: proposals.has(trace.id),
			...(trace.intentOpen === false ? { closed: true } : {}),
			...(closedAt === undefined ? {} : { closedAt }),
			...(trace.closesIntentionIds?.length ? { result: true } : {}),
			...((membership.scopesByTrace.get(trace.id)?.size ?? 0) > 1 ? { multi: true } : {}),
			label,
			...(forcedLabel === label ? {} : { forcedLabel }),
			timeLabel: traceTimeLabel(trace, language)
		};
	};
	/** The legend filter (solo, then hidden) over the kinds a mark answers to (research п. 17), and the kinds it follows (C4). */
	const keep = (item: Mark): boolean =>
		legendShown(legendKeysOf(item, now), legendFilter, legendFollows(item));
	const legendKeys = new Set<LegendKey>();
	/** The marks a row keeps, noting the kinds it offered before the filter: the legend lists those. */
	const shownMarks = (marks: readonly Mark[]): Mark[] =>
		marks.filter((item) => {
			const keys = legendKeysOf(item, now);
			for (const key of keys) legendKeys.add(key);
			return legendShown(keys, legendFilter, legendFollows(item));
		});

	const rows: ProjectedRow[] = [];
	const scopeById = new Map(snapshot.scopes.map((scope) => [scope.id, scope]));
	const unscopedName = translate(state.language ?? 'ru', UNSCOPED_ROW_KEY);
	// A Scope without records is a row too (ANSWERS Q9): what was made stays in sight.
	const liveChildren = (scopeId: string): string[] =>
		(tree.children.get(scopeId) ?? []).filter((childId) => !blocked.has(childId));
	/** A record counts for a row when it stands on the ribbon there: timed, and not hidden by the legend. */
	const onRibbon = (traceId: string, rowId: string): boolean => {
		const trace = traceById.get(traceId);
		const time = timeByTraceId.get(traceId);
		return Boolean(trace && time && keep(mark(trace, time, rowId, false)));
	};
	const arrangement = state.grouping === 'scope' ? (state.arrangement ?? null) : null;
	/** Scopes a lane holds by name: they stand at their lane, not under their expanded parent. */
	const claimed = new Set(arrangement?.lanes.flatMap((lane) => lane.members) ?? []);
	const visit = (scopeId: string, depth: number): void => {
		const scope = scopeById.get(scopeId);
		if (!scope || blocked.has(scopeId)) return;
		const all = subtree.get(scopeId) ?? new Set<string>();
		const direct = directByScope.get(scopeId) ?? new Set<string>();
		const children = liveChildren(scopeId);
		// The children this row can unfold: those no lane claimed. With none left, the row has no
		// chevron and stands folded — the claimed children stay in its roll-up (review 2026-09-19, п. 32).
		const emitted = children.filter((childId) => !claimed.has(childId));
		const isExpanded = emitted.length > 0 && expanded.has(scopeId);
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
			scopeIds: [scopeId],
			name: scope.name,
			colours: scopeColoursOf([scope]),
			depth,
			hasChildren: emitted.length > 0,
			expanded: isExpanded,
			// Owner 2026-09-15: the numbers say what the ribbon shows, not what the Scope holds.
			directCount: [...direct].filter((id) => onRibbon(id, scopeId)).length,
			subtreeCount: [...all].filter((id) => onRibbon(id, scopeId)).length,
			range: rangeOf(marks),
			marks: shownMarks(marks)
		});
		if (isExpanded) for (const childId of emitted) visit(childId, depth + 1);
	};

	const unscoped = traces.filter(
		(trace) => !query && (membership.scopesByTrace.get(trace.id)?.size ?? 0) === 0
	);
	// «Только эти Scope» is about Scopes: records in none are out of it (owner, 2026-09-18).
	const unscopedShown = state.grouping === 'scope' && unscoped.length > 0 && !state.onlyScopes;
	const unscopedRow = (depth = 0): ProjectedRow => {
		const marks: Mark[] = [];
		for (const trace of unscoped) {
			const time = timeByTraceId.get(trace.id);
			if (time) marks.push(mark(trace, time, UNSCOPED_ROW_ID, false));
		}
		const shown = shownMarks(marks);
		return {
			id: UNSCOPED_ROW_ID,
			kind: 'unscoped',
			scopeId: null,
			scopeIds: [],
			name: unscopedName,
			colours: [],
			depth,
			hasChildren: false,
			expanded: false,
			directCount: shown.length,
			subtreeCount: shown.length,
			range: rangeOf(marks),
			marks: shown
		};
	};
	/**
	 * A lane of several Scopes as one row (research п. 7, Q2-A): the union of the members'
	 * records, each once; a group member brings its direct records and the roll-up of its
	 * subtree as a collapsed row does, whatever the disclosure says. Each mark carries the
	 * colours of the members it answers to, so a record in two of them weaves. The chevron
	 * (loop 008, C5) unfolds the lane: the merged row stays as it is, and its members follow
	 * beneath it at depth 1, each as its ordinary row.
	 */
	const mergedRow = (lane: RowLane, members: readonly string[]): ProjectedRow => {
		const rowId = mergedRowId(members);
		const parts = new Map<string, { direct: boolean; colours: ScopeColour[] }>();
		const add = (traceId: string, direct: boolean, colour: ScopeColour | null): void => {
			const part =
				parts.get(traceId) ?? parts.set(traceId, { direct: false, colours: [] }).get(traceId)!;
			if (direct) part.direct = true;
			if (colour && !part.colours.some((c) => scopeColourKey(c) === scopeColourKey(colour)))
				part.colours.push(colour);
		};
		for (const member of members) {
			if (member === UNSCOPED_ROW_ID) {
				for (const trace of unscoped) add(trace.id, true, null);
				continue;
			}
			const direct = directByScope.get(member) ?? new Set<string>();
			const scope = scopeById.get(member);
			const colour = scope ? scopeColourPair(scope) : null;
			for (const traceId of subtree.get(member) ?? []) add(traceId, direct.has(traceId), colour);
		}
		const marks: Mark[] = [];
		let directCount = 0;
		let subtreeCount = 0;
		for (const [traceId, part] of parts) {
			const trace = traceById.get(traceId);
			const time = timeByTraceId.get(traceId);
			if (!trace || !time) continue;
			marks.push({ ...mark(trace, time, rowId, !part.direct), colours: part.colours });
			if (onRibbon(traceId, rowId)) {
				subtreeCount += 1;
				if (part.direct) directCount += 1;
			}
		}
		const scopeIds = members.filter((id) => id !== UNSCOPED_ROW_ID);
		const names = new Map<string, Readonly<{ name: string }>>(scopeById);
		names.set(UNSCOPED_ROW_ID, { name: unscopedName });
		return {
			id: rowId,
			kind: 'merged',
			scopeId: null,
			scopeIds,
			name: laneName({ ...lane, members }, names),
			colours: scopeColoursOf(scopeIds.flatMap((id) => scopeById.get(id) ?? [])),
			depth: 0,
			hasChildren: true,
			expanded: Boolean(lane.expanded),
			directCount,
			subtreeCount,
			range: rangeOf(marks),
			marks: shownMarks(marks)
		};
	};

	if (arrangement) {
		for (const lane of arrangement.lanes) {
			// A hidden or unknown member contributes nothing; a lane left with one member is that plain row.
			const members = lane.members.filter((id) =>
				id === UNSCOPED_ROW_ID ? unscopedShown : scopeById.has(id) && !blocked.has(id)
			);
			if (members.length === 0) continue;
			if (members.length > 1) {
				rows.push(mergedRow(lane, members));
				// Unfolded (C5): the members beneath the merged row, in lane order, each with its own
				// disclosure and roll-up; «Без Scope» as the unscoped row at depth 1.
				if (lane.expanded)
					for (const member of members)
						if (member === UNSCOPED_ROW_ID) rows.push(unscopedRow(1));
						else visit(member, 1);
			} else if (members[0] === UNSCOPED_ROW_ID) rows.push(unscopedRow());
			else visit(members[0], 0);
		}
	} else if (state.grouping === 'scope') {
		for (const rootId of tree.roots) visit(rootId, 0);
		if (unscopedShown) rows.push(unscopedRow());
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
				scopeIds: [],
				name,
				colours: [],
				depth: 0,
				hasChildren: false,
				expanded: false,
				directCount: marks.length,
				subtreeCount: marks.length,
				range: null,
				marks: shownMarks(marks)
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
		links,
		legendKeys
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
