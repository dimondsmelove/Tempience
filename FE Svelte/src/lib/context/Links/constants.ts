import type { MessageKey } from '$lib/state/Locale/types';
import type { TraceIntersectionKind } from '$lib/state/triplit/types';

/** Kinds «Найти и связать…» offers; `related_to` is the default (DESIGN.md §8, DP24). */
export const LINK_KINDS: readonly (readonly [TraceIntersectionKind, MessageKey])[] = [
	['related_to', 'linkKind.related_to'],
	['part_of', 'linkKind.part_of'],
	['evidence_for', 'linkKind.evidence_for'],
	['revisits', 'linkKind.revisits']
];

export const SEARCH_LIMIT = 8;
