import { sameHover } from '$lib/model/Hover/Hover';
import type { HoverTarget } from '$lib/model/Hover/types';

/**
 * What the pointer rests on: a record on the ribbon or a row by its name in the
 * rail (the band on the canvas hovers nothing, п. 14/15). Not a selection and never persisted; touch has
 * none. A repeat of the same target is not a change, so the canvas redraws once
 * per real move between things (research 2026-09-18, п. 5).
 */
export class HoverState {
	target = $state.raw<HoverTarget>(null);

	set(target: HoverTarget): void {
		if (!sameHover(this.target, target)) this.target = target;
	}

	trace(traceId: string): void {
		this.set({ kind: 'trace', traceId });
	}

	row(rowId: string): void {
		this.set({ kind: 'row', rowId });
	}

	clear(): void {
		this.set(null);
	}
}
