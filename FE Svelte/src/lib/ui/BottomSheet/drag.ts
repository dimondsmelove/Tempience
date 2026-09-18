import type { Attachment } from 'svelte/attachments';
import { SHEET_DRAG_THRESHOLD_PX, SHEET_VELOCITY_WINDOW_MS } from './constants';
import type { SheetDragOptions } from './types';

/** Only the grip and marked headers resize the sheet; body scrolling stays native. */
export const sheetDrag =
	(options: SheetDragOptions): Attachment<HTMLElement> =>
	(element) => {
		let origin: { y: number; height: number; pointerId: number } | null = null;
		let samples: { y: number; time: number }[] = [];
		let dragging = false;
		let suppressClick = false;
		const heightAt = (y: number) =>
			Math.max(0, Math.min(options.getLimit(), origin!.height + origin!.y - y));
		const down = (event: PointerEvent) => {
			if (event.button !== 0 || !event.isPrimary || origin) return;
			const target = event.target as Element;
			if (!target.closest('[data-sheet-drag-handle]')) return;
			if (target.closest('input, textarea, select, a, [contenteditable]')) return;
			origin = {
				y: event.clientY,
				height: element.getBoundingClientRect().height,
				pointerId: event.pointerId
			};
			samples = [{ y: event.clientY, time: event.timeStamp }];
			dragging = false;
			suppressClick = false;
		};
		const move = (event: PointerEvent) => {
			if (!origin || event.pointerId !== origin.pointerId) return;
			samples = samples.filter(
				(sample) => event.timeStamp - sample.time <= SHEET_VELOCITY_WINDOW_MS
			);
			samples.push({ y: event.clientY, time: event.timeStamp });
			if (!dragging && Math.abs(event.clientY - origin.y) < SHEET_DRAG_THRESHOLD_PX) return;
			if (!dragging) {
				dragging = true;
				element.setPointerCapture(event.pointerId);
			}
			event.preventDefault();
			options.ondrag(heightAt(event.clientY));
		};
		const finish = (event: PointerEvent, cancelled = false) => {
			if (!origin || event.pointerId !== origin.pointerId) return;
			if (dragging && !cancelled) {
				const first = samples.find(
					(sample) => event.timeStamp - sample.time <= SHEET_VELOCITY_WINDOW_MS
				);
				const elapsed = first ? event.timeStamp - first.time : 0;
				const velocity = first && elapsed > 0 ? (first.y - event.clientY) / elapsed : 0;
				options.onrelease(heightAt(event.clientY), velocity);
			}
			suppressClick = dragging;
			origin = null;
			dragging = false;
			options.ondrag(null);
			if (element.hasPointerCapture(event.pointerId))
				element.releasePointerCapture(event.pointerId);
		};
		const up = (event: PointerEvent) => finish(event);
		const cancel = (event: PointerEvent) => finish(event, true);
		const lostCapture = (event: PointerEvent) => {
			if (event.target === element) cancel(event);
		};
		// Cancel the handled touch drag so Chromium does not start a fling and swallow the next tap.
		const touchMove = (event: TouchEvent) => {
			if (dragging) event.preventDefault();
		};
		const click = (event: MouseEvent) => {
			if (!suppressClick || event.detail === 0) return;
			event.preventDefault();
			event.stopImmediatePropagation();
			suppressClick = false;
		};
		element.addEventListener('touchmove', touchMove, { passive: false });
		element.addEventListener('pointerdown', down);
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
		window.addEventListener('pointercancel', cancel);
		element.addEventListener('lostpointercapture', lostCapture);
		element.addEventListener('click', click, true);
		return () => {
			element.removeEventListener('touchmove', touchMove);
			element.removeEventListener('pointerdown', down);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', cancel);
			element.removeEventListener('lostpointercapture', lostCapture);
			element.removeEventListener('click', click, true);
		};
	};
