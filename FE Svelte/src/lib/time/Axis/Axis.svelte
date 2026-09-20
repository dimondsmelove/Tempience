<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { Attachment } from 'svelte/attachments';
	import { periodTitle } from '$lib/model/Axis/Axis';
	import type { AxisBand, PeriodRef } from '$lib/model/Axis/types';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { drawAxis, hitAt } from './draw';
	import { WHEEL_LINE_PX } from './constants';
	import type { AxisHit, AxisMetrics, AxisPalette, AxisProps } from './types';

	let { window, now, selected = null, hasNote, onselectperiod, onpan }: AxisProps = $props();

	/** Cell areas of the last draw; the DOM twin below mirrors them for keyboard and readers. */
	let hits = $state.raw<AxisHit[]>([]);
	/** The cell under the pointer or keyboard focus: off the step, its label shows as a ghost. */
	let hover = $state.raw<PeriodRef | null>(null);
	/** The rows of the last draw, so a threshold is crossed only once the scale is clearly past it. */
	let band: AxisBand | null = null;

	let signature = '';
	let paletteCache: AxisPalette | null = null;
	let metricsCache: AxisMetrics | null = null;
	const readAppearance = (element: HTMLElement) => {
		const next =
			appearance.style +
			'/' +
			element.clientHeight +
			'/' +
			getComputedStyle(document.documentElement).fontSize;
		if (signature === next && paletteCache && metricsCache)
			return { palette: paletteCache, metrics: metricsCache };
		const style = getComputedStyle(element);
		const probe = document.createElement('span');
		probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
		probe.setAttribute('aria-hidden', 'true');
		element.parentElement!.append(probe);
		const color = (name: string) => {
			probe.style.color = `var(${name})`;
			return getComputedStyle(probe).color;
		};
		const fontSize = (name: string) => {
			probe.style.fontSize = `var(${name})`;
			return getComputedStyle(probe).fontSize;
		};
		paletteCache = {
			ink: color('--cg-text-primary'),
			inkSecondary: color('--cg-text-secondary'),
			muted: color('--cg-text-muted'),
			accent: color('--cg-accent'),
			accentSubtle: color('--cg-accent-muted'),
			border: color('--cg-border-default'),
			borderStrong: color('--cg-border-strong'),
			surface: color('--cg-bg-surface'),
			sans: style.getPropertyValue('--cg-font-sans').trim(),
			mono: style.getPropertyValue('--cg-font-mono').trim()
		};
		metricsCache = {
			heightPx: element.clientHeight,
			majorFont: '600 ' + fontSize('--cg-axis-major'),
			minorFont: fontSize('--cg-axis-minor'),
			weekFont: fontSize('--cg-axis-week')
		};
		probe.remove();
		signature = next;
		return { palette: paletteCache, metrics: metricsCache };
	};

	/** Redraws whenever the window, «сейчас», selection, hover or the element size change. */
	const render: Attachment<HTMLCanvasElement> = (canvas) => {
		const draw = (): void => {
			const widthPx = canvas.clientWidth;
			if (widthPx === 0) return;
			const dpr = globalThis.devicePixelRatio || 1;
			canvas.width = Math.round(widthPx * dpr);
			canvas.height = Math.round(canvas.clientHeight * dpr);
			const context = canvas.getContext('2d');
			if (!context) return;
			const drawn = drawAxis({
				context,
				widthPx,
				dpr,
				window,
				now,
				selected,
				hasNote,
				hover,
				previousBand: band,
				language: locale.current,
				...readAppearance(canvas)
			});
			band = drawn.band;
			hits = drawn.hits;
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

	const wheelInput: Attachment<HTMLDivElement> = (element) => {
		const onwheel = (event: WheelEvent): void => {
			const width = element.clientWidth;
			if (!onpan || !event.deltaY || !width) return;
			event.preventDefault();
			const unit =
				event.deltaMode === WheelEvent.DOM_DELTA_LINE
					? WHEEL_LINE_PX
					: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
						? width
						: 1;
			onpan((-event.deltaY * unit) / width);
		};
		element.addEventListener('wheel', onwheel, { passive: false });
		return () => element.removeEventListener('wheel', onwheel);
	};

	const periodOf = (hit: AxisHit): PeriodRef => ({
		unit: hit.unit,
		start: hit.start,
		end: hit.end
	});
	const select = (hit: AxisHit): void => onselectperiod?.(periodOf(hit));
	const isSame = (period: PeriodRef | null, hit: AxisHit): boolean =>
		period !== null && period.unit === hit.unit && period.start === hit.start;
	const enter = (hit: AxisHit): void => {
		if (!isSame(hover, hit)) hover = periodOf(hit);
	};
	const leave = (hit: AxisHit): void => {
		if (isSame(hover, hit)) hover = null;
	};

	const onclick = (event: MouseEvent): void => {
		const rect = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
		const hit = hitAt(hits, event.clientX - rect.left, event.clientY - rect.top);
		if (hit) select(hit);
	};
</script>

<div class="relative" style:height="var(--cg-axis-height)" {@attach wheelInput}>
	<canvas
		class="block h-full w-full cursor-pointer"
		aria-label={t('axis.title')}
		{onclick}
		{@attach render}
	></canvas>
	<!-- Every cell is a period: the twin gives the same click, hover, focus ring and name in the DOM. -->
	<div class="absolute inset-0" role="group" aria-label={t('axis.labels')}>
		{#each hits as hit, index (index)}
			<button
				type="button"
				class="absolute cursor-pointer overflow-hidden rounded-sm text-transparent whitespace-nowrap select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
				style:left="{hit.x0}px"
				style:top="{hit.y0}px"
				style:width="{hit.x1 - hit.x0}px"
				style:height="{hit.y1 - hit.y0}px"
				data-row={hit.row}
				data-unit={hit.unit}
				data-drawn={hit.drawn || undefined}
				data-pinned={hit.pinned || undefined}
				data-note={hit.note || undefined}
				data-hover={isSame(hover, hit) || undefined}
				aria-label={periodTitle(hit, locale.current)}
				aria-pressed={isSame(selected, hit)}
				onpointerenter={() => enter(hit)}
				onpointerleave={() => leave(hit)}
				onfocus={() => enter(hit)}
				onblur={() => leave(hit)}
				onclick={() => select(hit)}>{hit.label}</button
			>
		{/each}
	</div>
</div>
