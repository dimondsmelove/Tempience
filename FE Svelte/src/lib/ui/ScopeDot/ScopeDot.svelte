<script lang="ts">
	import { appearance } from '$lib/theme/appearance.svelte';
	import { scopeColour } from '$lib/theme/scope-colour';
	import { DOT_ROW_PX } from './constants';
	import type { ScopeDotProps } from './types';

	let {
		colorHue,
		colorChroma = null,
		colorDepth = null,
		size = DOT_ROW_PX,
		testId
	}: ScopeDotProps = $props();
	const colour = $derived(
		colorHue === null || colorHue === undefined
			? null
			: scopeColour(colorHue, colorChroma, appearance.scopeBase, colorDepth)
	);
</script>

<!-- The Scope's colour as a round swatch by its name (owner review 2026-09-19, pack 3, P3/P5):
     the same rule the rail dot and the ribbon draw with; none when the Scope has no colour. -->
{#if colour !== null}
	<span
		class="dot"
		style:--dot={colour}
		style:--size="{size}px"
		data-testid={testId}
		data-color-hue={colorHue}
		data-color-chroma={colorChroma ?? undefined}
		data-color-depth={colorDepth ?? undefined}
		aria-hidden="true"
	></span>
{/if}

<style>
	.dot {
		display: inline-block;
		flex: none;
		width: var(--size);
		height: var(--size);
		border-radius: 9999px;
		background: var(--dot);
		vertical-align: middle;
	}
</style>
