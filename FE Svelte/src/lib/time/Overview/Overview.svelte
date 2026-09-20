<script lang="ts">
	import { dateTimeFormat } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { MapPinAltOutline } from 'flowbite-svelte-icons';
	import Button from '$lib/ui/Button/Button.svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import { scalePresets, PRESET_TOLERANCE } from '$lib/time/Toolbar/constants';
	import type { Attachment } from 'svelte/attachments';
	import type { TimeRange } from '$lib/model/Projection/types';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { createAppearanceReader } from '$lib/time/TimelineCanvas/appearance';
	import { EDGE_GRIP_PX, MIN_FRAME_PX, OVERVIEW_HEIGHT_PX } from './constants';
	import { densityBins, spanReadout, stripRange } from './density';
	import { drawOverview } from './draw';
	import { overviewInlays, shownRanges } from './inlays';
	import type { FrameGrip, OverviewProps } from './types';

	let {
		viewport,
		extent,
		rows,
		dimmed,
		inWindow,
		phone = false,
		canReveal = false,
		onreveal
	}: OverviewProps = $props();

	/**
	 * The density's input (B4): the records the ribbon shows, each once, at 1 — the search's
	 * misses at 18 % (п. 9) — so the strip follows the legend, the Scope filters and both searches.
	 */
	const weighted = $derived(shownRanges(rows, dimmed));
	/** The colour inlays (Q2-E): a 2 px mark at every shown record with a coloured Scope. */
	const inlays = $derived(overviewInlays(rows, dimmed));
	/** What the strip is built from, for the tests: the weight it holds and the hues it colours. */
	const weight = $derived(weighted.reduce((sum, item) => sum + (item.weight ?? 1), 0));
	const hues = $derived(
		[...new Set(inlays.flatMap((inlay) => inlay.colours.map((colour) => colour.hue)))].toSorted(
			(a, b) => a - b
		)
	);

	const readAppearance = createAppearanceReader();
	const readout = $derived(spanReadout(viewport.spanMs, locale.current));
	const activePreset = $derived(
		scalePresets.find(
			(preset) => Math.abs(preset.days - viewport.spanDays) / viewport.spanDays < PRESET_TOLERANCE
		)
	);
	const formatDate = (t: number, year: boolean) =>
		dateTimeFormat(locale.current, {
			day: '2-digit',
			month: '2-digit',
			...(year ? { year: 'numeric' as const } : {})
		}).format(t);
	const dates = $derived(
		`${formatDate(viewport.window.start, new Date(viewport.window.start).getFullYear() !== new Date(viewport.window.end).getFullYear())} — ${formatDate(viewport.window.end, true)}`
	);

	let dragRange = $state.raw<TimeRange | null>(null);
	const range = $derived(dragRange ?? stripRange(extent, viewport.window));

	/** Redraws with the window, the data, the theme and the element width. */
	const render: Attachment<HTMLCanvasElement> = (canvas) => {
		const draw = (): void => {
			const widthPx = canvas.clientWidth;
			const context = canvas.getContext('2d');
			if (widthPx === 0 || !context) return;
			const dpr = globalThis.devicePixelRatio || 1;
			canvas.width = Math.round(widthPx * dpr);
			canvas.height = Math.round(OVERVIEW_HEIGHT_PX * dpr);
			const { palette } = readAppearance(
				canvas,
				appearance.style + '/' + getComputedStyle(document.documentElement).fontSize,
				appearance.scopeBase
			);
			drawOverview({
				context,
				dpr,
				widthPx,
				range,
				window: viewport.window,
				now: viewport.now,
				bins: densityBins(weighted, range, Math.ceil(widthPx / 3)),
				inlays,
				palette
			});
		};
		draw();
		const observer = new ResizeObserver(draw);
		observer.observe(canvas);
		return () => observer.disconnect();
	};

	const timeAt = (event: PointerEvent, element: HTMLElement): number => {
		const rect = element.getBoundingClientRect();
		return range.start + ((event.clientX - rect.left) / rect.width) * (range.end - range.start);
	};
	const pxOf = (t: number, widthPx: number): number =>
		((t - range.start) / (range.end - range.start)) * widthPx;

	/** Drag inside the frame pans, drag on an edge zooms, a click outside jumps there. */
	const onpointerdown = (event: PointerEvent): void => {
		if (event.button !== 0) return;
		const element = event.currentTarget as HTMLCanvasElement;
		const widthPx = element.clientWidth;
		const x = event.clientX - element.getBoundingClientRect().left;
		const x0 = pxOf(viewport.window.start, widthPx);
		const x1 = pxOf(viewport.window.end, widthPx);
		let grip: FrameGrip = 'body';
		if (Math.abs(x - x0) <= EDGE_GRIP_PX) grip = 'start';
		else if (Math.abs(x - x1) <= EDGE_GRIP_PX) grip = 'end';
		else if (x < x0 || x > x1) viewport.centreOn(timeAt(event, element));
		dragRange = range;
		// Clicking outside travels to the new centre; a subsequent drag starts from that destination.
		const origin = { t: timeAt(event, element), window: viewport.target };
		const minSpan = viewport.limits.minSpanMs;
		const onmove = (move: PointerEvent): void => {
			const delta = timeAt(move, element) - origin.t;
			viewport.stopFollow();
			if (grip === 'body')
				viewport.set({ start: origin.window.start + delta, end: origin.window.end + delta });
			else if (grip === 'start')
				viewport.set({
					start: Math.min(origin.window.start + delta, origin.window.end - minSpan),
					end: origin.window.end
				});
			else
				viewport.set({
					start: origin.window.start,
					end: Math.max(origin.window.end + delta, origin.window.start + minSpan)
				});
		};
		const onup = (): void => {
			element.removeEventListener('pointermove', onmove);
			element.removeEventListener('pointerup', onup);
			element.removeEventListener('pointercancel', onup);
			dragRange = null;
		};
		element.setPointerCapture(event.pointerId);
		element.addEventListener('pointermove', onmove);
		element.addEventListener('pointerup', onup);
		element.addEventListener('pointercancel', onup);
		event.preventDefault();
	};
</script>

<div
	class={[
		'overview-row relative flex shrink-0 items-center gap-1 border-b border-outline bg-surface',
		phone && 'phone-overview'
	]}
	style:height={phone ? '44px' : `${OVERVIEW_HEIGHT_PX}px`}
	data-testid="overview"
>
	<Popover
		id="time-scale"
		label={t('overview.window', { dates, span: readout, count: inWindow })}
		testId="window-readout"
		class="strip-control font-mono"
	>
		{#snippet trigger()}
			<span class="window-dates" data-testid="window-dates">{dates} ·</span>
			<span data-testid="window-span" data-days={viewport.spanDays}>{readout}</span>
			<span
				class="window-count text-muted"
				data-testid="window-count"
				title={t('overview.uniqueInWindow')}>{t('overview.inWindow', { count: inWindow })}</span
			> ▾
		{/snippet}
		{#snippet children(close)}
			<ul class="flex min-w-32 flex-col gap-1" aria-label={t('overview.scale')}>
				{#each scalePresets as preset (preset.days)}
					<li>
						<Button
							size="sm"
							variant="quiet"
							class="w-full justify-start"
							pressed={activePreset?.days === preset.days}
							onclick={() => {
								viewport.setSpanDays(preset.days);
								close();
							}}>{t(preset.label)}</Button
						>
					</li>
				{/each}
			</ul>
		{/snippet}
	</Popover>
	{#if phone}
		<Button
			icon
			variant="quiet"
			pressed={viewport.follow}
			aria-label="Live"
			onclick={() => viewport.toggleFollow()}
			><span aria-hidden="true">●</span><span class="live-label">Live</span></Button
		>
		<Button
			icon
			variant="quiet"
			disabled={!canReveal}
			aria-label={t('overview.toSelected')}
			data-testid="go-to-selected"
			onclick={onreveal}><MapPinAltOutline class="h-4 w-4" /></Button
		>
	{:else}
		<div class="h-full min-w-6 flex-1">
			<canvas
				class="block h-full w-full cursor-ew-resize touch-none"
				style:min-width="{MIN_FRAME_PX}px"
				aria-hidden="true"
				data-testid="overview-strip"
				data-weight={weight.toFixed(2)}
				data-inlays={inlays.length}
				data-inlay-hues={hues.join(' ')}
				data-range-start={range.start}
				data-range-end={range.end}
				{onpointerdown}
				{@attach render}
			></canvas>
		</div>
	{/if}
	<Button
		size="sm"
		variant="quiet"
		icon
		class="strip-control"
		aria-label={t('overview.zoomOut')}
		onclick={() => viewport.zoomOut()}>−</Button
	>
	<Button
		size="sm"
		variant="quiet"
		icon
		class="strip-control"
		aria-label={t('overview.zoomIn')}
		onclick={() => viewport.zoomIn()}>+</Button
	>
	<span class="sr-only" data-testid="overview-readout"
		>{t('overview.readout', { span: readout })}</span
	>
</div>

<style>
	.overview-row {
		container-type: inline-size;
		font-size: var(--cg-text-size-caption);
	}
	.overview-row :global(.strip-control) {
		min-height: 26px;
		height: 26px;
		padding-block: 0;
	}
	@container (max-width: 40em) {
		.window-dates,
		.window-count {
			display: none;
		}
	}
	@media (max-width: 72rem) {
		.window-dates,
		.window-count {
			display: none;
		}
	}

	.phone-overview {
		gap: 0;
		padding-inline: 0.25rem;
	}
	.phone-overview :global(.strip-control) {
		min-height: 44px;
		height: 44px;
	}
	.phone-overview :global([data-testid='window-readout']) {
		flex: 1;
		min-width: 0;
		justify-content: flex-start;
		overflow: hidden;
		padding-inline: 0.25rem;
		font-size: var(--cg-text-size-caption);
	}
	.phone-overview .window-dates {
		display: inline;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.phone-overview :global([data-testid='window-span']),
	.phone-overview .window-count {
		display: none;
	}
	.phone-overview :global(button:not([data-testid='window-readout'])) {
		min-width: 36px;
		min-height: 44px;
		padding-inline: 0.375rem;
	}
	@media (max-width: 380px) {
		.live-label {
			display: none;
		}
	}
</style>
