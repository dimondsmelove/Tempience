import { select } from 'd3-selection';
import { zoom, zoomIdentity, type D3ZoomEvent, type ZoomTransform } from 'd3-zoom';
import type { Attachment } from 'svelte/attachments';
import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { WHEEL_DURATION_MS } from '$lib/state/Viewport/constants';
import { spanOf, timeAtPx } from '$lib/state/Viewport/math';
import { SCALE_EXTENT, SHIFT_WHEEL_PAN_RATIO } from './constants';

type ZoomEvent = D3ZoomEvent<HTMLElement, unknown>;

/**
 * Where d3 anchored a scale change: the pixel that stayed put between two transforms.
 * From `next.x = p - (p - prev.x) * ratio`.
 */
const anchorPx = (prev: ZoomTransform, next: ZoomTransform, ratio: number): number =>
	(next.x - prev.x * ratio) / (1 - ratio);

/**
 * Wheel, drag, pinch and double-click on the lanes, translated into viewport
 * commands. d3-zoom is used as a gesture source only: every event is applied
 * as a delta against the previous transform, and the transform is reset to
 * identity when a gesture ends, so the viewport stays the single source of
 * truth and programmatic window changes need no sync back.
 */
export const zoomInput =
	(viewport: ViewportState, onScrollRows: (deltaPx: number) => void): Attachment<HTMLElement> =>
	(element) => {
		let previous: ZoomTransform = zoomIdentity;
		let dragY: number | null = null;

		const behavior = zoom<HTMLElement, unknown>()
			.scaleExtent(SCALE_EXTENT)
			.filter((event: Event) => {
				if (event.type === 'wheel') return !(event as WheelEvent).shiftKey;
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
				const duration = event.sourceEvent?.type === 'wheel' ? WHEEL_DURATION_MS : 0;
				const base = duration ? viewport.target : viewport.window;
				let expectedX = previous.x;
				if (ratio !== 1) {
					const px = anchorPx(previous, next, ratio);
					viewport.zoomAt(1 / ratio, timeAtPx(base, px, width), duration);
					expectedX = px - (px - previous.x) * ratio;
				}
				const residualPx = next.x - expectedX;
				if (Math.abs(residualPx) > 0.01) {
					viewport.pan((-residualPx / width) * spanOf(base), duration);
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

		const onShiftWheel = (event: WheelEvent): void => {
			if (!event.shiftKey) return;
			event.preventDefault();
			const delta = event.deltaY || event.deltaX;
			viewport.pan(
				(delta / 100) * SHIFT_WHEEL_PAN_RATIO * spanOf(viewport.target),
				WHEEL_DURATION_MS
			);
		};
		element.addEventListener('wheel', onShiftWheel, { passive: false });

		return () => {
			select(element).on('.zoom', null);
			element.removeEventListener('wheel', onShiftWheel);
		};
	};
