import { dragTarget } from '$lib/model/RailDrag/RailDrag';
import { DRAG_THRESHOLD_PX } from '$lib/model/RailDrag/constants';
import type { DropTarget, RowBand } from '$lib/model/RailDrag/types';
import type { DragSource } from './types';

type Held = {
	source: DragSource;
	/** The row pressed: it captures the pointer once the press is a drag. */
	element: Element;
	pointerId: number;
	startY: number;
	list: HTMLElement;
	cancelled: boolean;
};

/**
 * The pointer gesture over the rail (loop 006 C2; mock v6.2): a press on a row's grip or
 * name, a drag once the pointer has moved `DRAG_THRESHOLD_PX`, the target under the pointer
 * as `dragTarget` resolves it, then the drop or the cancel. Mouse and pen only (Q5-A). Every
 * coordinate is the list's own: the lane rows' layout offsets and the pointer against the list.
 */
export class RailDrag {
	#held: Held | null = null;
	/** The pressed row, once the press is a drag; `null` between gestures. */
	source = $state.raw<DragSource | null>(null);
	/** The pointer's y in the list while dragging: the ghost of the source row hangs under it. */
	pointerY = $state(0);
	target = $state.raw<DropTarget | null>(null);
	/** The top of the 2 px insert line, in the list, while `target` is an insert; kept inside the list. */
	lineTop = $state(0);
	/** The click that follows a drop, or the release of a cancelled drag, is not a click on the row. */
	swallowClick = false;
	readonly #drop: (source: DragSource, target: DropTarget) => void;
	readonly #started: () => void;

	constructor(
		drop: (source: DragSource, target: DropTarget) => void,
		started: () => void = () => {}
	) {
		this.#drop = drop;
		this.#started = started;
	}

	get active(): boolean {
		return this.source !== null;
	}

	/** Pointer down on a handle: a finger and the other buttons never start anything. */
	press(event: PointerEvent, source: DragSource, list: HTMLElement): void {
		if (event.pointerType === 'touch' || event.button !== 0 || this.#held) return;
		this.swallowClick = false;
		this.#held = {
			source,
			element: event.currentTarget as Element,
			pointerId: event.pointerId,
			startY: localY(event, list),
			list,
			cancelled: false
		};
	}

	move(event: PointerEvent): void {
		const held = this.#held;
		if (!held || held.cancelled || event.pointerId !== held.pointerId) return;
		const y = localY(event, held.list);
		if (!this.source) {
			if (Math.abs(y - held.startY) <= DRAG_THRESHOLD_PX) return;
			// Captured only now: a plain click and a double click keep their target, the name.
			held.element.setPointerCapture(held.pointerId);
			this.source = held.source;
			this.#started();
		}
		this.pointerY = y;
		const bands = laneBands(held.list);
		this.target = dragTarget(y, bands, {
			alt: event.altKey,
			source: held.source.band,
			previous: this.target
		});
		if (this.target?.kind === 'insert') {
			const edge =
				this.target.index < bands.length ? bands[this.target.index].top : held.list.offsetHeight;
			this.lineTop = Math.min(Math.max(edge - 1, 0), held.list.offsetHeight - 2);
		}
	}

	release(event: PointerEvent): void {
		const held = this.#held;
		if (!held || event.pointerId !== held.pointerId) return;
		if (this.source && this.target) this.#drop(this.source, this.target);
		if (this.source || held.cancelled) {
			// The click, if any, follows in this same task; a row gone with the drop sends none.
			this.swallowClick = true;
			setTimeout(() => (this.swallowClick = false), 0);
		}
		this.abort();
	}

	/** Esc: the rows stay as they are, and the release still to come is not a click. */
	cancel(): void {
		if (!this.#held) return;
		this.#held.cancelled = true;
		this.source = null;
		this.target = null;
	}

	/** The pointer is gone (`pointercancel`, capture lost): nothing dropped, nothing pending. */
	abort(): void {
		this.#held = null;
		this.source = null;
		this.target = null;
	}
}

const localY = (event: PointerEvent, list: HTMLElement): number =>
	event.clientY - list.getBoundingClientRect().top;

/** The lane rows' extents in list coordinates, in lane order. */
const laneBands = (list: HTMLElement): RowBand[] =>
	[...list.querySelectorAll<HTMLElement>('li[data-band]')].map((row) => ({
		top: row.offsetTop,
		bottom: row.offsetTop + row.offsetHeight
	}));
