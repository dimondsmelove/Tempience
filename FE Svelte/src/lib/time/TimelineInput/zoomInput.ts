import { select } from 'd3-selection';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomTransform } from 'd3-zoom';
import type { Attachment } from 'svelte/attachments';
import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { WHEEL_DURATION_MS } from '$lib/state/Viewport/constants';
import { spanOf, timeAtPx } from '$lib/state/Viewport/math';
import { PINCH_ZOOM_GAIN, SCALE_EXTENT, SHIFT_WHEEL_PAN_RATIO, WHEEL_ZOOM_UNIT } from './constants';
import { WHEEL_LINE_PX } from '$lib/time/Axis/constants';
import { WheelSourceReader } from './wheelSource';

type ZoomEvent = D3ZoomEvent<HTMLElement, unknown>;

/**
 * Where d3 anchored a scale change: the pixel that stayed put between two transforms.
 * From `next.x = p - (p - prev.x) * ratio`.
 */
const anchorPx = (prev: ZoomTransform, next: ZoomTransform, ratio: number): number =>
	(next.x - prev.x * ratio) / (1 - ratio);

/** A wheel's vertical travel in px: a line counted as the Axis counts it, a page as the width. */
export const wheelPx = (event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>, widthPx: number): number =>
	event.deltaY *
	(event.deltaMode === WheelEvent.DOM_DELTA_LINE
		? WHEEL_LINE_PX
		: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
			? widthPx
			: 1);

/** The span factor of a wheel delta: d3's reading, so the feel of the ribbon does not change. */
export const wheelZoomFactor = (
	event: Pick<WheelEvent, 'deltaY' | 'deltaMode' | 'ctrlKey'>
): number =>
	Math.pow(
		2,
		event.deltaY *
			(WHEEL_ZOOM_UNIT[event.deltaMode] ?? WHEEL_ZOOM_UNIT[0]) *
			(event.ctrlKey ? PINCH_ZOOM_GAIN : 1)
	);

/**
 * Drag, touch pinch and double-click on the lanes go through d3-zoom, used as a gesture
 * source only: every event is applied as a delta against the previous transform, and the
 * transform is reset to identity when a gesture ends, so the viewport stays the single
 * source of truth and programmatic window changes need no sync back.
 *
 * The wheel is read here, not by d3, because it means different things by its source and
 * place: over the lanes a mouse notch walks through time — down to the past, up to the
 * future, as over the Axis (owner, 2026-09-29; the zoom moved to the Axis and the chapter
 * band); a trackpad pinch still zooms at the pointer; a trackpad swipe moves time sideways
 * and the rows up and down; Shift and any wheel move time.
 */
export const zoomInput =
	(viewport: ViewportState, onScrollRows: (deltaPx: number) => void): Attachment<HTMLElement> =>
	(element) => {
		let previous: ZoomTransform = zoomIdentity;
		let dragY: number | null = null;
		const source = new WheelSourceReader();

		const behavior = zoom<HTMLElement, unknown>()
			.scaleExtent(SCALE_EXTENT)
			.filter((event: Event) => {
				if (event.type === 'wheel') return false;
				if (event.type === 'mousedown') return (event as MouseEvent).button === 0;
				return true;
			})
			.on('start', (event: ZoomEvent) => {
				const source = event.sourceEvent as MouseEvent | TouchEvent | undefined;
				dragY =
					source?.type === 'mousedown'
						? (source as MouseEvent).clientY
						: source?.type === 'touchstart' && (source as TouchEvent).touches.length === 1
							? (source as TouchEvent).touches[0].clientY
							: null;
			})
			.on('zoom', (event: ZoomEvent) => {
				const next = event.transform;
				const width = element.clientWidth;
				if (width === 0) return;
				const ratio = next.k / previous.k;
				const base = viewport.window;
				let expectedX = previous.x;
				if (ratio !== 1) {
					const px = anchorPx(previous, next, ratio);
					viewport.zoomAt(1 / ratio, timeAtPx(base, px, width), 0);
					expectedX = px - (px - previous.x) * ratio;
				}
				const residualPx = next.x - expectedX;
				if (Math.abs(residualPx) > 0.01) {
					viewport.pan((-residualPx / width) * spanOf(base), 0);
				}
				const source = event.sourceEvent as MouseEvent | TouchEvent | undefined;
				const y =
					source?.type === 'mousemove'
						? (source as MouseEvent).clientY
						: source?.type === 'touchmove' && (source as TouchEvent).touches.length === 1
							? (source as TouchEvent).touches[0].clientY
							: null;
				// Scrolling moves the lanes; viewport coordinates avoid feedback. Pinch resets the scroll anchor.
				if (y !== null && dragY !== null) onScrollRows(dragY - y);
				dragY = y;
				previous = next;
			})
			.on('end', () => {
				dragY = null;
				previous = zoomIdentity;
				select(element).property('__zoom', zoomIdentity);
			});

		select(element).call(behavior);

		const onWheel = (event: WheelEvent): void => {
			const width = element.clientWidth;
			if (width === 0) return;
			const target = viewport.target;
			if (event.shiftKey) {
				event.preventDefault();
				const delta = event.deltaY || event.deltaX;
				viewport.pan((delta / 100) * SHIFT_WHEEL_PAN_RATIO * spanOf(target), WHEEL_DURATION_MS);
				return;
			}
			if (event.ctrlKey) {
				event.preventDefault();
				const px = event.clientX - element.getBoundingClientRect().left;
				viewport.zoomAt(wheelZoomFactor(event), timeAtPx(target, px, width), WHEEL_DURATION_MS);
				return;
			}
			if (source.read(event, event.timeStamp) === 'mouse') {
				event.preventDefault();
				viewport.pan((-wheelPx(event, width) / width) * spanOf(target), WHEEL_DURATION_MS);
				return;
			}
			// A trackpad swipe: sideways is time, up and down is the scroller's own scrolling.
			if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
				event.preventDefault();
				viewport.pan((event.deltaX / width) * spanOf(target), 0);
			}
		};
		element.addEventListener('wheel', onWheel, { passive: false });

		return () => {
			select(element).on('.zoom', null);
			element.removeEventListener('wheel', onWheel);
		};
	};
