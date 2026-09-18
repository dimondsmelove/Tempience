<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { clusterOf, hitAt } from '$lib/model/HitTest/HitTest';
	import { MIN_ROWS_HEIGHT_PX } from '$lib/model/Layout/constants';
	import { layoutRibbon } from '$lib/model/Layout/Layout';
	import type { RibbonLayout } from '$lib/model/Layout/types';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { createAppearanceReader } from './appearance';
	import { drawRibbon } from './draw';
	import Twin from './Twin.svelte';
	import type { TimelineCanvasProps } from './types';

	let {
		rows,
		window,
		now,
		selectedTraceId,
		links,
		showScopeRange,
		rowHeightPx,
		minHeightPx = 0,
		onselect,
		onzoomto,
		onempty
	}: TimelineCanvasProps = $props();

	const readAppearance = createAppearanceReader();
	let layout = $state.raw<RibbonLayout | null>(null);
	let pointer = $state(false);
	const heightPx = $derived(
		Math.max(minHeightPx, rows.length ? rows.length * rowHeightPx : MIN_ROWS_HEIGHT_PX)
	);

	/** Redraws whenever rows, the window, the selection, the theme or the element width change. */
	const render: Attachment<HTMLCanvasElement> = (canvas) => {
		const draw = (): void => {
			const widthPx = canvas.clientWidth;
			if (widthPx === 0) return;
			const context = canvas.getContext('2d');
			if (!context) return;
			const dpr = globalThis.devicePixelRatio || 1;
			const signature =
				appearance.style + '/' + getComputedStyle(document.documentElement).fontSize;
			const { palette, metrics } = readAppearance(canvas, signature);
			const widths: Record<string, number> = {};
			context.font = `${metrics.captionPx}px ${palette.sans}`;
			const measure = (text: string): number => (widths[text] ??= context.measureText(text).width);
			const next = layoutRibbon(rows, {
				window,
				widthPx,
				measure,
				selectedTraceId,
				fontPx: metrics.captionPx,
				rowHeightPx,
				minHeightPx
			});
			canvas.width = Math.round(widthPx * dpr);
			canvas.height = Math.round(next.heightPx * dpr);
			drawRibbon({
				context,
				dpr,
				layout: next,
				palette,
				metrics,
				now,
				selectedTraceId,
				links,
				showScopeRange
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
		if (!layout) return;
		const hit = hitAt(layout, ...localPoint(event));
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

	const onmousemove = (event: MouseEvent): void => {
		if (!layout) return;
		const hit = hitAt(layout, ...localPoint(event));
		pointer = hit?.type === 'mark' || hit?.type === 'label';
	};
</script>

<canvas
	class={['block w-full', pointer && 'cursor-pointer']}
	style:height="{heightPx}px"
	data-testid="ribbon-canvas"
	aria-hidden="true"
	{onclick}
	{onmousemove}
	onmouseleave={() => (pointer = false)}
	{@attach render}
></canvas>
<Twin {layout} {selectedTraceId} {onselect} />
