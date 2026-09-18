import { panWindow, spanOf, timeAtPx } from '$lib/state/Viewport/math';
import { snapped, stepAt } from './TimeInput';
import type { TimeWindow } from '$lib/state/Viewport/types';
import type { TimeInputState } from './TimeInputState.svelte';
import type { DragKind, TimeSelection } from './types';

export function railGestures(element: HTMLElement, state: TimeInputState): () => void {
	const pointers = new Map<number, number>();
	let drag: {
		x: number;
		kind: DragKind;
		window: TimeWindow;
		value: TimeSelection;
		moved: boolean;
		edge: 'start' | 'end';
		pickingEnd: boolean;
	} | null = null;
	let pinch: { distance: number; anchor: number; window: TimeWindow } | null = null;
	let cancelled = false;
	const xAt = (event: PointerEvent | WheelEvent) =>
		event.clientX - element.getBoundingClientRect().left;
	const down = (event: PointerEvent) => {
		if (event.button !== 0) return;
		const x = xAt(event);
		pointers.set(event.pointerId, x);
		element.setPointerCapture(event.pointerId);
		cancelled = false;
		if (pointers.size === 1) {
			const kind = (event.target as Element).closest<HTMLElement>('[data-drag]')?.dataset.drag as
				DragKind | undefined;
			state.viewport.set(state.viewport.window);
			drag = {
				x,
				kind: kind ?? 'pan',
				window: state.viewport.window,
				value: state.draft,
				moved: false,
				edge: state.edge,
				pickingEnd: state.pickingEnd
			};
		} else if (pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			pinch = {
				distance: Math.max(1, Math.abs(a - b)),
				anchor: timeAtPx(state.viewport.window, (a + b) / 2, element.clientWidth),
				window: state.viewport.window
			};
			if (drag) drag.moved = true;
		}
	};
	const move = (event: PointerEvent) => {
		if (!pointers.has(event.pointerId) || cancelled) return;
		const x = xAt(event),
			width = element.clientWidth;
		pointers.set(event.pointerId, x);
		if (pinch && pointers.size === 2) {
			const [a, b] = [...pointers.values()];
			const span = (spanOf(pinch.window) * pinch.distance) / Math.max(1, Math.abs(a - b));
			const start = pinch.anchor - ((a + b) / 2 / width) * span;
			state.windowTo({ start, end: start + span });
			return;
		}
		if (!drag || pinch) return;
		const dx = x - drag.x;
		if (Math.abs(dx) < 5 && !drag.moved) return;
		drag.moved = true;
		element.dataset.dragging = drag.kind;
		const delta = (dx / width) * spanOf(drag.window);
		if (drag.kind === 'pan') state.windowTo(panWindow(drag.window, -delta));
		else {
			const base = drag.value;
			const origin = drag.kind === 'end' ? (base.end ?? base.start) : base.start;
			const step = stepAt(drag.window, width, state.mode);
			if (drag.kind === 'move') {
				const target = snapped(origin + delta, state.mode, step);
				// The band translates both boundaries; handles edit one boundary.
				state.translate(target, step, base);
			} else if (drag.kind === 'extend')
				state.pick(timeAtPx(drag.window, x, width), 'end', step, base);
			else state.pick(origin + delta, drag.kind, step, base);
		}
	};
	const up = (event: PointerEvent) => {
		if (!pointers.has(event.pointerId)) return;
		if (!cancelled && !pinch && drag && !drag.moved) {
			if (drag.kind === 'pan')
				state.pick(
					timeAtPx(state.viewport.window, xAt(event), element.clientWidth),
					state.edge,
					stepAt(state.viewport.window, element.clientWidth, state.mode)
				);
			else if (drag.kind === 'extend') state.beginEnd();
			else if (drag.kind === 'start' || drag.kind === 'end') {
				state.edge = drag.kind;
				state.pickingEnd = false;
			}
		}
		pointers.delete(event.pointerId);
		if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
		if (!pointers.size) {
			drag = null;
			pinch = null;
			delete element.dataset.dragging;
		}
	};
	const cancel = (event: PointerEvent) => {
		if (drag) {
			state.draft = drag.value;
			state.edge = drag.edge;
			state.pickingEnd = drag.pickingEnd;
			state.viewport.set(drag.window);
		}
		cancelled = true;
		up(event);
		delete element.dataset.dragging;
	};
	const wheel = (event: WheelEvent) => {
		event.preventDefault();
		const base = state.viewport.target;
		if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
			state.windowTo(
				panWindow(base, ((event.deltaX || event.deltaY) / element.clientWidth) * spanOf(base)),
				140
			);
		} else
			state.zoom(
				Math.exp(Math.max(-0.35, Math.min(0.35, event.deltaY * 0.003))),
				timeAtPx(state.viewport.window, xAt(event), element.clientWidth)
			);
	};
	element.addEventListener('pointerdown', down);
	element.addEventListener('pointermove', move);
	element.addEventListener('pointerup', up);
	element.addEventListener('pointercancel', cancel);
	element.addEventListener('wheel', wheel, { passive: false });
	return () => {
		element.removeEventListener('pointerdown', down);
		element.removeEventListener('pointermove', move);
		element.removeEventListener('pointerup', up);
		element.removeEventListener('pointercancel', cancel);
		element.removeEventListener('wheel', wheel);
	};
}
