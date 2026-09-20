<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { DEFAULT_CHROMA, DEFAULT_DEPTH, QUICK_HUES, scopeColour } from '$lib/theme/scope-colour';
	import { chromaBarGradient, hueBarGradient } from './ColorHuePicker';
	import {
		CHROMA_KEY,
		CHROMA_MAX_PERCENT,
		CHROMA_MIN_PERCENT,
		HUE_KEY,
		HUE_MAX,
		HUE_MIN,
		NO_COLOUR_KEY,
		QUICK_KEY
	} from './constants';
	import type { ColorHuePickerProps } from './types';

	let { hue, chroma, depth = null, onpick, label, testId }: ColorHuePickerProps = $props();
	const uid = $props.id();
	const hueId = uid + '-hue';
	const chromaId = uid + '-chroma';
	const base = $derived(appearance.scopeBase);
	// The bars and every swatch are painted by the colour rule on the theme of the moment, so a
	// switch of theme recolours the picker as it recolours the ribbon. The depth is kept as is.
	const chromaShown = $derived(chroma ?? DEFAULT_CHROMA);
	const depthKept = $derived(depth ?? DEFAULT_DEPTH);
	const hueBar = $derived(hueBarGradient(chromaShown, base, depthKept));
	const chromaBar = $derived(hue === null ? undefined : chromaBarGradient(hue, base, depthKept));
	const colour = $derived(hue === null ? null : scopeColour(hue, chroma, base, depthKept));
	const said = $derived(hue === null ? t(NO_COLOUR_KEY) : t(HUE_KEY, { h: hue }));
	const id = (suffix: string): string | undefined => (testId ? `${testId}-${suffix}` : undefined);
	const pickHue = (next: number): void => onpick({ hue: next, chroma, depth: depthKept });
	const pickChroma = (next: number): void => {
		if (hue !== null) onpick({ hue, chroma: next, depth: depthKept });
	};
</script>

<!-- A free hue and its saturation (R1, owner 2026-09-19): the first bar is the circle 0–359°
     in the colour each hue takes in this mode at the saturation chosen; the second runs the
     saturation 0–100 of the hue chosen; each thumb shows the colour the Scope gets; arrows
     step by one. Under them, «без цвета» and twelve quick picks 30° apart, tight (24 px,
     6 px gaps). The component is a thin skin over `{hue, chroma}`: a richer picker replaces it. -->
<fieldset class="picker text-sm" data-testid={testId}>
	<legend class="legend">{label}</legend>
	<div class="bar-row">
		<input
			id={hueId}
			type="range"
			class={['bar', hue === null && 'bar-none']}
			min={HUE_MIN}
			max={HUE_MAX}
			step="1"
			value={hue ?? HUE_MIN}
			aria-label={t('scope.hue')}
			aria-valuetext={said}
			style:--bar={hueBar}
			style:--thumb={colour ?? 'transparent'}
			data-testid={id('hue')}
			data-color-hue={hue ?? undefined}
			oninput={(event) => pickHue(event.currentTarget.valueAsNumber)}
		/>
		<output class="value text-muted" for={hueId} data-testid={id('value')}>{said}</output>
	</div>
	<div class="bar-row">
		<input
			id={chromaId}
			type="range"
			class="bar"
			min={CHROMA_MIN_PERCENT}
			max={CHROMA_MAX_PERCENT}
			step="1"
			value={chromaShown}
			disabled={hue === null}
			aria-label={t(CHROMA_KEY)}
			aria-valuetext={hue === null ? t(NO_COLOUR_KEY) : `${chromaShown} %`}
			style:--bar={chromaBar ?? 'var(--cg-border-default)'}
			style:--thumb={colour ?? 'transparent'}
			data-testid={id('chroma')}
			data-color-chroma={hue === null ? undefined : chromaShown}
			oninput={(event) => pickChroma(event.currentTarget.valueAsNumber)}
		/>
		<output class="value text-muted" for={chromaId} data-testid={id('chroma-value')}
			>{hue === null ? '—' : `${chromaShown} %`}</output
		>
	</div>
	<div class="quick" role="group" aria-label={t(QUICK_KEY)}>
		<button
			type="button"
			class="swatch swatch-none"
			aria-pressed={hue === null}
			aria-label={t(NO_COLOUR_KEY)}
			title={t(NO_COLOUR_KEY)}
			data-testid={id('none')}
			onclick={() => onpick(null)}
		></button>
		{#each QUICK_HUES as quick (quick)}
			{@const title = t(HUE_KEY, { h: quick })}
			<button
				type="button"
				class="swatch"
				style:--dot={scopeColour(quick, chroma, base, depthKept)}
				aria-pressed={hue === quick}
				aria-label={title}
				{title}
				data-testid={id(`quick-${quick}`)}
				onclick={() => pickHue(quick)}
			></button>
		{/each}
	</div>
</fieldset>

<style>
	.picker {
		display: grid;
		gap: calc(var(--cg-gap) * 0.5);
		min-width: 0;
		border: 0;
		padding: 0;
	}
	.legend {
		padding: 0;
	}
	.bar-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 6.5em;
		gap: calc(var(--cg-gap) * 0.75);
		align-items: center;
	}
	.value {
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
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
	/* «Без цвета»: the thumb is an empty ring at the bar's start, as a record without a Scope colour. */
	.bar-none::-webkit-slider-thumb,
	.bar:disabled::-webkit-slider-thumb {
		background: var(--cg-bg-surface);
	}
	.bar-none::-moz-range-thumb,
	.bar:disabled::-moz-range-thumb {
		background: var(--cg-bg-surface);
	}
	/* Quick picks: 24 px swatches, 6 px apart (owner: no wide gaps between the dots). */
	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.swatch {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: 9999px;
		background: var(--dot);
		cursor: pointer;
	}
	.swatch:hover {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--cg-text-primary) 40%, transparent);
	}
	.swatch:focus-visible {
		outline: 2px solid var(--cg-focus);
		outline-offset: 2px;
	}
	/* «Без цвета»: an ink outline, empty inside. */
	.swatch-none {
		background: transparent;
		border: var(--cg-border-width) solid var(--cg-text-primary);
	}
	/* The current value: an ink ring set 2 px off the swatch, the selection language of the ribbon (п. 4). */
	.swatch[aria-pressed='true'] {
		box-shadow:
			0 0 0 2px var(--cg-bg-surface),
			0 0 0 3px var(--cg-text-primary);
	}
</style>
