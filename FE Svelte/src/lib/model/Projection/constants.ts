import type { IntersectionKind } from '$lib/state/triplit/types';
import type { LegendKey } from '$lib/model/Legend/types';

export const UNSCOPED_ROW_ID = '__unscoped__';
/** The rows of the projection that are not a Scope, named by the interface. */
export const UNSCOPED_ROW_KEY = 'projection.unscoped' as const;
export const KIND_ROWS = [
	{ kind: 'moment', name: 'projection.moments' },
	{ kind: 'interval', name: 'projection.intervals' },
	{ kind: 'fuzzy', name: 'projection.fuzzy' }
] as const;

/** Record-to-record intersection kinds that read as explicit links of a selected record. */
export const TRACE_LINK_KINDS: readonly IntersectionKind[] = [
	'part_of',
	'evidence_for',
	'revisits',
	'related_to'
];

export const EMPTY_PROJECTION_STATE = Object.freeze({
	expanded: new Set<string>(),
	hiddenScopes: new Set<string>(),
	onlyScopes: null,
	hiddenLegend: new Set<LegendKey>(),
	soloLegend: null,
	scopeQuery: '',
	grouping: 'scope' as const
});

/** The caption glyph of a closed intention by its outcome; a closed one without an outcome is a hollow dot. */
export const INTENT_GLYPHS: Readonly<
	Record<'completed' | 'partial' | 'not_completed' | 'alternative', string>
> = {
	completed: '✓',
	partial: '◐',
	not_completed: '✕',
	alternative: '↷'
};
export const CLOSED_INTENT_GLYPH = '○';
/** Before the closing day in a forced caption: «○ Сдать документы · ✓ 6 сен» (loop 008, C4). */
export const CLOSED_AT_GLYPH = '✓';
