import type { MessageKey } from '$lib/state/Locale/types';
import type { IntersectionKind } from '$lib/state/triplit/types';
/** How a link kind is named; read through `t` where it is shown. */
export const INTERSECTION_KEYS: Record<IntersectionKind, MessageKey> = {
	belongs_to: 'intersection.belongs_to',
	contains: 'intersection.contains',
	child_of: 'intersection.child_of',
	part_of: 'intersection.part_of',
	evidence_for: 'intersection.evidence_for',
	revisits: 'intersection.revisits',
	related_to: 'intersection.related_to'
};
