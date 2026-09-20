<script lang="ts">
	import type { BlossomColorPickerColor } from '@dayflow/blossom-color-picker';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import {
		DEFAULT_CHROMA,
		DEFAULT_DEPTH,
		scopeColour,
		type ScopeColour
	} from '$lib/theme/scope-colour';
	import { BlossomFlower, BlossomPopover } from '$lib/ui/BlossomPopover';
	import type { BlossomSource } from '$lib/ui/BlossomPopover/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import { chromaBarGradient, hueBarGradient } from '../ColorHuePicker/ColorHuePicker';
	import {
		CHROMA_MAX_PERCENT,
		CHROMA_MIN_PERCENT,
		HUE_MAX,
		HUE_MIN
	} from '../ColorHuePicker/constants';
	import {
		CHROMA_KEY,
		FINE_KEY,
		FLOWER_TEST_ID,
		HUE_KEY,
		NO_COLOUR_KEY,
		QUICK_KEY,
		SHOW_EXACT_CONTROLS
	} from './constants';
	import {
		blossomPalette,
		blossomPetals,
		blossomValue,
		nearestPetal,
		petalHue,
		readBlossomChange,
		saturationArc
	} from './palette';
	import type { ColorBlossomPickerProps } from './types';
	import { colourReadout, dotName, petalName } from './words';

	let {
		hue,
		chroma,
		depth = null,
		onpick,
		label,
		testId,
		variant = 'field',
		size
	}: ColorBlossomPickerProps = $props();
	const uid = $props.id();
	const hueId = uid + '-hue';
	const chromaId = uid + '-chroma';
	const base = $derived(appearance.scopeBase);
	const chromaShown = $derived(chroma ?? DEFAULT_CHROMA);
	const depthShown = $derived(depth ?? DEFAULT_DEPTH);
	// The library's petals are one fixed palette; what they show follows the theme and the saturation, as the ribbon does.
	const petals = blossomPetals();
	const shown = $derived(blossomPalette(base, chromaShown));
	const value = $derived(blossomValue(petals, hue, chroma, depthShown));
	const selected = $derived(hue === null ? null : nearestPetal(hue, depthShown));
	const colour = $derived(hue === null ? null : scopeColour(hue, chroma, base, depthShown));
	const arc = $derived(saturationArc(hue, base, depthShown));
	const said = $derived(hue === null ? t(NO_COLOUR_KEY) : t(HUE_KEY, { h: hue }));
	const readout = $derived(colourReadout(t, hue, chroma, depth));
	const name = $derived(variant === 'dot' ? dotName(t, hue, chroma, depth) : undefined);
	const words = $derived({
		group: t(QUICK_KEY),
		petal: (index: number) => petalName(t, petalHue(index), petals[index].depth)
	});
	const hueBar = $derived(hueBarGradient(chromaShown, base, depthShown));
	const chromaBar = $derived(hue === null ? undefined : chromaBarGradient(hue, base, depthShown));
	const id = (suffix: string): string | undefined => (testId ? `${testId}-${suffix}` : undefined);
	const pick = (next: ScopeColour | undefined): void => {
		if (next !== undefined) onpick(next);
	};
	const onchange = (change: BlossomColorPickerColor, source: BlossomSource): void =>
		pick(readBlossomChange(petals, change, { hue, chroma, depth }, source));
	const pickHue = (next: number): void => onpick({ hue: next, chroma, depth: depthShown });
	const pickChroma = (next: number): void => {
		if (hue !== null) onpick({ hue, chroma: next, depth: depthShown });
	};
</script>

<!-- The Scope's colour: a dot that opens the Blossom flower (owner 2026-09-19, pack 3, P1).
     Seventy-two petals — twenty-four hues in three rings, one ring per depth (C6) — are the
     safe palette of the theme at the saturation chosen, each `scopeColour(hue, chroma, base,
     depth)`, so a petal shows what the ribbon will draw; the light ring is innermost, the deep
     ring outermost; the arc is the saturation 0–100 of the hue chosen at its depth; the core
     and the swatch the colour picked. A petal sets the hue and the depth and keeps the
     saturation, the arc keeps both; «Без цвета» clears all. The library speaks HSL — its `hue`
     is a petal's name, its `hex` never drawn: `palette.ts` maps a petal to our degree and depth
     and the arc's position to our saturation. As a `dot` the trigger is the Context Scope's
     12 px dot (D). The readout and the exact ranges stay behind `SHOW_EXACT_CONTROLS`. -->
<div
	class={['picker flex items-center text-sm', variant === 'field' && 'gap-2']}
	data-testid={testId}
>
	{#if variant === 'field'}<span>{label}</span>{/if}
	<BlossomPopover
		id={uid + '-flower'}
		{label}
		{readout}
		{colour}
		{name}
		{variant}
		{size}
		{testId}
		data={{
			'data-color-hue': hue === null ? undefined : String(hue),
			'data-color-chroma': hue === null ? undefined : String(chromaShown),
			'data-color-depth': hue === null ? undefined : String(depthShown)
		}}
	>
		<div class="panel">
			<BlossomFlower
				{petals}
				{shown}
				{value}
				{selected}
				{arc}
				{colour}
				{words}
				{onchange}
				testId={testId ? FLOWER_TEST_ID : undefined}
			/>
			<div class="row">
				<Button
					size="sm"
					pressed={hue === null}
					data-testid={id('none')}
					onclick={() => onpick(null)}>{t(NO_COLOUR_KEY)}</Button
				>
				{#if SHOW_EXACT_CONTROLS}
					<output class="value text-muted" data-testid={id('value')}>{readout}</output>
				{/if}
			</div>
			{#if SHOW_EXACT_CONTROLS}
				<details class="fine">
					<summary class="text-muted">{t(FINE_KEY)}</summary>
					<div class="bar-row">
						<label for={hueId}>{t('scope.hue')}</label>
						<input
							id={hueId}
							type="range"
							class={['bar', hue === null && 'bar-none']}
							min={HUE_MIN}
							max={HUE_MAX}
							step="1"
							value={hue ?? HUE_MIN}
							aria-valuetext={said}
							style:--bar={hueBar}
							style:--thumb={colour ?? 'transparent'}
							data-testid={id('hue')}
							data-color-hue={hue ?? undefined}
							oninput={(event) => pickHue(event.currentTarget.valueAsNumber)}
						/>
					</div>
					<div class="bar-row">
						<label for={chromaId}>{t(CHROMA_KEY)}</label>
						<input
							id={chromaId}
							type="range"
							class="bar"
							min={CHROMA_MIN_PERCENT}
							max={CHROMA_MAX_PERCENT}
							step="1"
							value={chromaShown}
							disabled={hue === null}
							aria-valuetext={hue === null ? t(NO_COLOUR_KEY) : `${chromaShown} %`}
							style:--bar={chromaBar ?? 'var(--cg-border-default)'}
							style:--thumb={colour ?? 'transparent'}
							data-testid={id('chroma')}
							data-color-chroma={hue === null ? undefined : chromaShown}
							oninput={(event) => pickChroma(event.currentTarget.valueAsNumber)}
						/>
					</div>
				</details>
			{/if}
		</div>
	</BlossomPopover>
</div>

<style>
	.picker {
		min-width: 0;
	}
	/* Inside the popover: the flower, then «без цвета» (and the exact controls, when shown). */
	.panel {
		display: grid;
		gap: calc(var(--cg-gap) * 0.5);
		max-width: 100%;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(var(--cg-gap) * 0.75);
	}
	.value {
		font-variant-numeric: tabular-nums;
	}
	/* «Точно»: the two native ranges of the plain picker, folded until asked for. */
	.fine {
		display: grid;
		gap: calc(var(--cg-gap) * 0.5);
	}
	.fine summary {
		width: max-content;
		cursor: pointer;
	}
	.bar-row {
		display: grid;
		grid-template-columns: 7em minmax(0, 1fr);
		gap: calc(var(--cg-gap) * 0.75);
		align-items: center;
	}
	/* A bar: a native range, its track the colours it runs through, its thumb the colour picked. */
	.bar {
		appearance: none;
		width: 100%;
		height: 24px;
		margin: 0;
		background: transparent;
		cursor: pointer;
	}
	.bar:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.bar:focus-visible {
		outline: 2px solid var(--cg-focus);
		outline-offset: 2px;
		border-radius: 6px;
	}
	.bar::-webkit-slider-runnable-track {
		height: 12px;
		border-radius: 6px;
		background: var(--bar);
	}
	.bar::-moz-range-track {
		height: 12px;
		border-radius: 6px;
		background: var(--bar);
	}
	.bar::-webkit-slider-thumb {
		appearance: none;
		width: 20px;
		height: 20px;
		margin-top: -4px;
		border-radius: 9999px;
		background: var(--thumb);
		border: 2px solid var(--cg-bg-surface);
		box-shadow: 0 0 0 1px var(--cg-text-primary);
	}
	.bar::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 9999px;
		background: var(--thumb);
		border: 2px solid var(--cg-bg-surface);
		box-shadow: 0 0 0 1px var(--cg-text-primary);
	}
	.bar-none::-webkit-slider-thumb,
	.bar:disabled::-webkit-slider-thumb {
		background: var(--cg-bg-surface);
	}
	.bar-none::-moz-range-thumb,
	.bar:disabled::-moz-range-thumb {
		background: var(--cg-bg-surface);
	}
</style>
