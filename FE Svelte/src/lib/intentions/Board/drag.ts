import type { OrderTarget } from '../Order/Order';

export type DraggedIntention = {
	id: string;
	open: boolean;
	source?: OrderTarget;
	nested?: boolean;
};
export const sameTarget = (a: OrderTarget | undefined, b: OrderTarget): boolean => {
	if (!a || a.kind !== b.kind) return false;
	if (a.kind === 'day' && b.kind === 'day') return a.dayKey === b.dayKey;
	if (a.kind === 'week' && b.kind === 'week') return a.weekStart === b.weekStart;
	return true;
};
export const canDrop = (drag: DraggedIntention | null, target?: OrderTarget): boolean =>
	!!drag?.open &&
	!!target &&
	(target.kind !== 'later' || sameTarget(drag.source, target)) &&
	!(drag.nested && sameTarget(drag.source, target));
