import { Temporal } from 'temporal-polyfill';
import type { ExplorerIntersection, ExplorerScope, ExplorerTrace } from '$lib/model/Snapshot/types';
import type { Hierarchy } from '../Hierarchy/Hierarchy';
import { dateLabel } from './createForm';

export const traceDate = (trace: ExplorerTrace, zone: string) =>
	trace.aboutTime?.basis === 'absolute'
		? trace.aboutTime.precision === 'minute'
			? Temporal.Instant.from(trace.aboutTime.start)
					.toZonedDateTimeISO(zone)
					.toPlainDate()
					.toString()
			: trace.aboutTime.start.slice(0, 10)
		: '';
export const scopesOf = (
	id: string,
	scopes: readonly ExplorerScope[],
	links: readonly ExplorerIntersection[]
) =>
	scopes.filter((scope) =>
		links.some((link) => link.kind === 'belongs_to' && link.fromId === id && link.toId === scope.id)
	);
export const panelRelations = (
	id: string,
	hierarchy: Hierarchy,
	traces: readonly ExplorerTrace[]
) => {
	const byId = new Map(traces.map((trace) => [trace.id, trace]));
	const resolve = (ids: readonly string[]) =>
		ids.map((item) => byId.get(item)).filter((item): item is ExplorerTrace => !!item);
	const entry = hierarchy.get(id);
	return {
		parents: resolve(entry?.parents ?? []),
		children: resolve(entry?.children ?? []),
		progress: entry?.progress ?? null,
		closeSuggested: entry?.closeSuggested ?? false
	};
};
export const childDateLabel = (
	trace: ExplorerTrace,
	zone: string,
	locale: string,
	undated: string
) => {
	const dayKey = traceDate(trace, zone);
	return dateLabel(dayKey ? { kind: 'day', dayKey } : { kind: 'undated' }, locale, '', undated);
};

export type PanelView = { kind: 'backlog' | 'done' } | { kind: 'task' | 'edit'; id: string };
export type PanelHistory = { views: PanelView[]; index: number };
const sameView = (a: PanelView | undefined, b: PanelView) =>
	a?.kind === b.kind &&
	((a.kind !== 'task' && a.kind !== 'edit') ||
		((b.kind === 'task' || b.kind === 'edit') && a.id === b.id));
/** Opening the view that is already shown changes nothing; the history keeps no repeats. */
export const openView = (history: PanelHistory, view: PanelView): PanelHistory =>
	sameView(history.views[history.index], view)
		? history
		: {
				views: [...history.views.slice(0, history.index + 1), view],
				index: history.index + 1
			};
export const moveHistory = (history: PanelHistory, delta: -1 | 1): PanelHistory => ({
	...history,
	index: Math.max(0, Math.min(history.views.length - 1, history.index + delta))
});
