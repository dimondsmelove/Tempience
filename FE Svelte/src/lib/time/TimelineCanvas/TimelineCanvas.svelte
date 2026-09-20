<script lang="ts">
	import { untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion, Tween } from 'svelte/motion';
	import { clusterOf, hitAt } from '$lib/model/HitTest/HitTest';
	import { canvasHover, hoverKey } from '$lib/model/Hover/Hover';
	import { linkedTraceIds } from '$lib/model/Labels/budget';
	import type { Caption, MeasureText } from '$lib/model/Labels/types';
	import { MIN_ROWS_HEIGHT_PX } from '$lib/model/Layout/constants';
	import { layoutRibbon } from '$lib/model/Layout/Layout';
	import type { LayoutOptions, RibbonLayout } from '$lib/model/Layout/types';
	import { PULSE_MS } from '$lib/model/Pulse/constants';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { createAppearanceReader } from './appearance';
	import { HOVER_HOLD_MS, VEIL_EASE_MS } from './constants';
	import { drawRibbon } from './draw';
	import Twin from './Twin.svelte';
	import type { TimelineCanvasProps } from './types';

	let {
		rows,
		window,
		now,
		selectedTraceId,
		links,
		linksShown,
		lit,
		focus,
		hover,
		lens,
		veil,
		moving,
		pulse,
		dimmed,
		searching,
		rowHeightPx,
		minHeightPx = 0,
		onselect,
		onhover,
		onzoomto,
		onempty
	}: TimelineCanvasProps = $props();

	const readAppearance = createAppearanceReader();
	let layout = $state.raw<RibbonLayout | null>(null);
	/** The captions the last draw put on the canvas, row by row: what the twin says about them. */
	let captions = $state.raw<readonly Caption[][] | null>(null);
	let pointer = $state(false);
	/** Records an explicit link touches: such facts rank before other facts for the caption budget (Q1-A). */
	const linked = $derived(linkedTraceIds(linksShown ? links : []));
	const heightPx = $derived(
		Math.max(minHeightPx, rows.length ? rows.length * rowHeightPx : MIN_ROWS_HEIGHT_PX)
	);

	/**
	 * The veil (loop 008, B): its goal is the device's strength while something is hovered, none
	 * otherwise; the alpha eases there over 120 ms and jumps under reduced motion.
	 */
	const veilGoal = $derived(hover ? veil : 0);
	const veilAlpha = new Tween(0, { duration: VEIL_EASE_MS, easing: cubicOut });
	$effect(() => {
		void veilAlpha.set(veilGoal, { duration: prefersReducedMotion.current ? 0 : VEIL_EASE_MS });
	});
	/** The veil is on: what the twin marks `data-veiled`, from the goal rather than the eased alpha. */
	const veiled = $derived(veilGoal > 0);
	/** `data-veil`: the eased alpha to two decimals, «0» when none. */
	const veilText = $derived(String(Math.round(veilAlpha.current * 100) / 100));

	/**
	 * «Куда смотреть» (loop 008, C3): the ring's growth 0…1 over `PULSE_MS`, restarted for each
	 * pulse by its `at`; at 1 nothing is drawn. Under reduced motion it never starts.
	 */
	const ring = new Tween(1, { duration: PULSE_MS, easing: cubicOut });
	$effect(() => {
		const at = pulse?.at;
		if (at === undefined || prefersReducedMotion.current) return;
		void ring.set(0, { duration: 0 });
		void ring.set(1);
	});
	/** `data-pulse`: the key of the pulse while its ring is still growing; absent otherwise. */
	const pulseKey = $derived(pulse && ring.current < 1 ? pulse.key : undefined);

	/**
	 * The last layout and what it was built from. A hover or a search keystroke
	 * changes only how the same layout draws, so it costs one redraw and no
	 * packing (п. 5); the layout is rebuilt when its own inputs change.
	 */
	type LayoutKey = Readonly<
		Omit<LayoutOptions, 'measure'> & { rows: typeof rows; signature: string }
	>;
	let cached: { key: LayoutKey; layout: RibbonLayout } | null = null;
	const sameKey = (a: LayoutKey, b: LayoutKey): boolean =>
		a.rows === b.rows &&
		a.window === b.window &&
		a.widthPx === b.widthPx &&
		a.selectedTraceId === b.selectedTraceId &&
		a.fontPx === b.fontPx &&
		a.rowHeightPx === b.rowHeightPx &&
		a.minHeightPx === b.minHeightPx &&
		a.linked === b.linked &&
		a.signature === b.signature;

	/** Redraws whenever rows, the window, the selection, the hover, the veil, the search, the theme or the element width change. */
	const render: Attachment<HTMLCanvasElement> = (canvas) => {
		const draw = (): void => {
			const widthPx = canvas.clientWidth;
			if (widthPx === 0) return;
			const context = canvas.getContext('2d');
			if (!context) return;
			const dpr = globalThis.devicePixelRatio || 1;
			const signature =
				appearance.style + '/' + getComputedStyle(document.documentElement).fontSize;
			const { palette, metrics } = readAppearance(canvas, signature, appearance.scopeBase);
			/** Cached `measureText` in one font; the regular for captions at rest, the 600 for the strong ones. */
			const measurer = (font: string): MeasureText => {
				const widths: Record<string, number> = {};
				return (text) => {
					if (widths[text] === undefined) {
						context.font = font;
						widths[text] = context.measureText(text).width;
					}
					return widths[text];
				};
			};
			const measure = measurer(`${metrics.captionPx}px ${palette.sans}`);
			const measureStrong = measurer(`600 ${metrics.captionPx}px ${palette.sans}`);
			const key: LayoutKey = {
				rows,
				window,
				widthPx,
				selectedTraceId,
				fontPx: metrics.captionPx,
				rowHeightPx,
				minHeightPx,
				linked,
				signature
			};
			const next =
				cached && sameKey(cached.key, key)
					? cached.layout
					: layoutRibbon(rows, { ...key, measure });
			cached = { key, layout: next };
			canvas.width = Math.round(widthPx * dpr);
			canvas.height = Math.round(next.heightPx * dpr);
			captions = drawRibbon({
				context,
				dpr,
				layout: next,
				palette,
				metrics,
				now,
				selectedTraceId,
				links,
				linksShown,
				lit,
				focus,
				hover,
				lens,
				veil: veilAlpha.current,
				pulse: pulse ? { traceIds: pulse.traceIds, progress: ring.current } : null,
				dimmed,
				searching,
				measure,
				measureStrong
			});
			layout = next;
		};
		draw();
		const frame = requestAnimationFrame(draw);
		const observer = new ResizeObserver(draw);
		observer.observe(canvas);
		document.fonts.addEventListener('loadingdone', draw);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			document.fonts.removeEventListener('loadingdone', draw);
		};
	};

	const localPoint = (event: MouseEvent): [number, number] => {
		const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
		return [event.clientX - rect.left, event.clientY - rect.top];
	};

	/** d3-zoom swallows the click that ends a drag, so a click here is a clean one. */
	const onclick = (event: MouseEvent): void => {
		if (!layout || !captions) return;
		// The captions as drawn are the ones that answer the pointer (pack 4, B).
		const hit = hitAt(layout, ...localPoint(event), captions);
		if (!hit || hit.type === 'row') {
			onempty?.();
			return;
		}
		if (hit.type === 'label') {
			const box = layout.rows
				.flatMap((row) => row.boxes)
				.find((candidate) => candidate.mark.id === hit.label.markId);
			if (box) onselect(box.mark.traceId, 'canvas');
			return;
		}
		if (hit.type !== 'mark') return;
		const cluster = clusterOf(hit.boxes);
		if (cluster) onzoomto(cluster.range, cluster.traceIds);
		else onselect(hit.boxes[0].mark.traceId, 'canvas');
	};

	// --- The hover and its hold (loop 008, B): no flicker under a zoom or a drag.
	/** Where the pointer last was over the canvas, in canvas pixels; null once it left. */
	let last: [number, number] | null = null;
	/** A wheel notch was just read over the canvas; released `HOVER_HOLD_MS` after the last one. */
	let wheeling = $state(false);
	let wheelTimer: ReturnType<typeof setTimeout> | undefined;
	/** A mouse button is down over the canvas: a drag (pan) may be in progress. */
	let dragging = $state(false);
	/** While held, the pointer's moves change no target; the release hit-tests the last position once. */
	const held = $derived(moving || wheeling || dragging);
	/** What the pointer rests on now, from the last known position: a record under a mark or its caption. */
	const emitAt = (point: [number, number] | null): void => {
		if (!layout || !captions || !point) return;
		const hit = hitAt(layout, ...point, captions);
		pointer = hit?.type === 'mark' || hit?.type === 'label';
		// A record under a mark or its caption; a row's empty band hovers nothing (review 2026-09-19, п. 14/15).
		onhover(canvasHover(hit, layout.rows));
	};
	$effect(() => {
		if (held) return;
		// The hold ended: the layout under the resting pointer may have moved on, so read it once.
		untrack(() => emitAt(last));
	});

	/** A mouse or a pen hovers; a finger has nothing to hover with, so touch leaves the ribbon as it is. */
	const onpointermove = (event: PointerEvent): void => {
		if (event.pointerType === 'touch') return;
		last = localPoint(event);
		if (!held) emitAt(last);
	};
	const onpointerleave = (): void => {
		last = null;
		pointer = false;
		onhover(null);
	};
	const onpointerdown = (event: PointerEvent): void => {
		if (event.pointerType !== 'touch' && event.button === 0) dragging = true;
	};
	const onwheel = (): void => {
		wheeling = true;
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => {
			wheeling = false;
		}, HOVER_HOLD_MS);
	};
	$effect(() => () => clearTimeout(wheelTimer));
</script>

<svelte:window
	onpointerup={() => {
		dragging = false;
	}}
	onpointercancel={() => {
		dragging = false;
	}}
/>

<canvas
	class={['block w-full', pointer && 'cursor-pointer']}
	style:height="{heightPx}px"
	data-testid="ribbon-canvas"
	data-hover={hoverKey(hover)}
	data-veil={veilText}
	data-pulse={pulseKey}
	aria-hidden="true"
	{onclick}
	{onpointermove}
	{onpointerleave}
	{onpointerdown}
	{onwheel}
	{@attach render}
></canvas>
<Twin {layout} {captions} {selectedTraceId} {lit} {hover} {lens} {veiled} {onselect} />
