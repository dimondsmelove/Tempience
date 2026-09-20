import type { MessageKey } from '$lib/state/Locale/types';
import type { MarkKind } from '$lib/model/Projection/types';
import type { LegendKey, LegendStateKey } from './types';

/** The legend's order, as the approved mock lists the vocabulary. */
export const LEGEND_KEYS: readonly LegendKey[] = [
	'fact',
	'interval',
	'open',
	'fuzzy',
	'intent',
	'overdue',
	'closed',
	'fuzzyIntent',
	'proposal',
	'rollup',
	'multi'
];

export const LEGEND_KEY_LABELS: Readonly<Record<LegendKey, MessageKey>> = {
	fact: 'legend.fact',
	interval: 'legend.interval',
	open: 'legend.open',
	fuzzy: 'legend.fuzzy',
	intent: 'legend.intent',
	overdue: 'legend.overdue',
	closed: 'legend.closed',
	fuzzyIntent: 'legend.fuzzyIntent',
	proposal: 'legend.proposal',
	rollup: 'legend.rollup',
	multi: 'legend.multi'
};

/** The legend kind a kind row's eye toggles: its plain silhouette (the row's intentions answer to their own kinds). */
export const KIND_ROW_LEGEND: Readonly<Record<MarkKind, LegendKey>> = {
	moment: 'fact',
	interval: 'interval',
	fuzzy: 'fuzzy'
};

/** State items are always listed and never filter (п. 17). */
export const LEGEND_STATES: readonly LegendStateKey[] = ['selected', 'projections', 'link'];

export const LEGEND_STATE_LABELS: Readonly<Record<LegendStateKey, MessageKey>> = {
	selected: 'legend.selected',
	projections: 'legend.projections',
	link: 'legend.link'
};
