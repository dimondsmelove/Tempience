import type { DropTarget } from '$lib/model/Arrangement/types';

export type { DropTarget };

/** A lane row of the rail as the pointer meets it: its vertical extent, in the rail's own coordinates. */
export type RowBand = Readonly<{ top: number; bottom: number }>;

export type DragTargetOptions = Readonly<{
	/** Alt held: the row under the pointer is a merge target whatever the zone («Открытые вопросы» п. 1). */
	alt?: boolean;
	/** The band of the dragged lane itself: a drop on it or right beside it is nothing. `null` for a child row. */
	source?: number | null;
	/** The target of the previous move: a boundary it sits at holds for ±`HYSTERESIS_PX`. */
	previous?: DropTarget | null;
}>;
