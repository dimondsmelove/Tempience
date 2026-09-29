<script lang="ts">
	import { untrack } from 'svelte';
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
	import { ROW_MOVE_MS } from '$lib/model/RowMotion/constants';
	import {
		ghostOffsetsAt,
		motionRows,
		offsetsAt,
		planGhosts,
		planMotion,
		shiftLayout
	} from '$lib/model/RowMotion/RowMotion';
	import type { Ghost, MotionPlan } from '$lib/model/RowMotion/types';
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
		animateRows = false,
		onselect,
		onhover,
		onzoomto,
		onempty
	}: TimelineCanvasProps = $props();

	const readAppearance = createAppearanceReader();
	/**
	 * The last layout drawn and the captions it drew, row by row: what the pointer hits. Plain
	 * values, written every frame; nothing on the page re-renders from them.
	 */
	let layout: RibbonLayout | null = null;
	let captions: readonly Caption[][] | null = null;
	/**
	 * What the twin says: the same pair, taken only while the ribbon stands still — no glide, no
	 * camera travel — so a moving ribbon writes nothing to the DOM frame by frame.
	 */
	let twin = $state.raw<
		Readonly<{
			layout: RibbonLayout | null;
			captions: readonly Caption[][] | null;
		}>
	>({ layout: null, captions: null });
	/** The canvas element, and its CSS width as the resize observer last reported it: no layout read per frame. */
	let canvas = $state<HTMLCanvasElement | null>(null);
	let widthPx = $state(0);
	/** The root font size, read once per appearance: `getComputedStyle` per frame would flush styles. */
	let rootFont: Readonly<{ style: string; size: string }> | null = null;
	/** `measureText` widths by font, kept across frames; cleared when web fonts finish loading. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a measurement cache, never read reactively
	const widthsByFont = new Map<string, Record<string, number>>();
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
	/**
	 * The lanes' glide under way: each moving row's offset at its start, and when it began. The
	 * rows are drawn eased from their old places to the new layout's, frame by frame.
	 */
	let glide: {
		plan: MotionPlan;
		/** Rows folding away into another, drawn as they were until the glide ends. */
		ghosts: readonly Ghost[];
		ghostRows: RibbonLayout['rows'];
		startedAt: number;
	} | null = null;
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

	let glideFrame = 0;
	/**
	 * Draws the ribbon once for its current inputs. Run by the effect below, it tracks rows, the
	 * window, the selection, the hover, the veil, the search, the theme and the width; a glide
	 * asks for its next frame itself, outside any tracking.
	 */
	const draw = (canvas: HTMLCanvasElement): void => {
		if (widthPx === 0) return;
		const context = canvas.getContext('2d');
		if (!context) return;
		const dpr = globalThis.devicePixelRatio || 1;
		if (rootFont?.style !== appearance.style)
			rootFont = {
				style: appearance.style,
				size: getComputedStyle(document.documentElement).fontSize
			};
		const signature = appearance.style + '/' + rootFont.size;
		const { palette, metrics } = readAppearance(canvas, signature, appearance.scopeBase);
		/** Cached `measureText` in one font; the regular for captions at rest, the 600 for the strong ones. */
		const measurer = (font: string): MeasureText => {
			let widths = widthsByFont.get(font);
			if (!widths) widthsByFont.set(font, (widths = {}));
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
		const previous = cached;
		const next =
			previous && sameKey(previous.key, key)
				? previous.layout
				: layoutRibbon(rows, { ...key, measure });
		cached = { key, layout: next };
		// New rows in another order: they glide from where they stood, as the rail's names do.
		if (previous && previous.key.rows !== rows) {
			const moves = animateRows && !prefersReducedMotion.current;
			const before = motionRows(previous.layout);
			const after = motionRows(next);
			const plan = moves ? planMotion(before, after) : new Map<string, number>();
			const ghosts = moves ? planGhosts(before, after) : [];
			const folding = new Set(ghosts.map((ghost) => ghost.id));
			glide =
				plan.size || ghosts.length
					? {
							plan,
							ghosts,
							ghostRows: previous.layout.rows.filter((row) => folding.has(row.row.id)),
							startedAt: performance.now()
						}
					: null;
		}
		const progress = glide ? (performance.now() - glide.startedAt) / ROW_MOVE_MS : 1;
		if (progress >= 1) glide = null;
		const drawn = glide
			? shiftLayout(
					{ ...next, rows: [...next.rows, ...glide.ghostRows] },
					new Map([...offsetsAt(glide.plan, progress), ...ghostOffsetsAt(glide.ghosts, progress)])
				)
			: next;
		// Resizing the bitmap reallocates and clears it: only when the size really changed.
		const bitmapWidth = Math.round(widthPx * dpr);
		const bitmapHeight = Math.round(next.heightPx * dpr);
		if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
		if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
		// The bitmap is kept between frames, so is its context: each frame starts from a clean state.
		context.save();
		try {
			captions = drawRibbon({
				context,
				dpr,
				layout: drawn,
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
		} finally {
			context.restore();
		}
		layout = next;
		if (glide) {
			cancelAnimationFrame(glideFrame);
			glideFrame = requestAnimationFrame(() => draw(canvas));
		} else if (!moving) twin = { layout: next, captions };
	};

	// One draw per change of what the ribbon shows.
	$effect(() => {
		if (canvas) draw(canvas);
	});
	// The width from the observer, the fonts once they load: set up once per canvas.
	$effect(() => {
		const element = canvas;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => {
			widthPx = entry.contentRect.width;
		});
		observer.observe(element);
		const fontsLoaded = (): void => {
			widthsByFont.clear();
			cached = null;
			untrack(() => draw(element));
		};
		document.fonts.addEventListener('loadingdone', fontsLoaded);
		return () => {
			cancelAnimationFrame(glideFrame);
			observer.disconnect();
			document.fonts.removeEventListener('loadingdone', fontsLoaded);
		};
	});

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
	{@attach (element) => {
		canvas = element;
		return () => {
			canvas = null;
		};
	}}
></canvas>
<Twin
	layout={twin.layout}
	captions={twin.captions}
	{selectedTraceId}
	{lit}
	{hover}
	{lens}
	{veiled}
	{onselect}
/>
