<script lang="ts">
	import type { BlossomColorPickerColor } from '@dayflow/blossom-color-picker';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { BlossomFlower, BlossomPopover } from '$lib/ui/BlossomPopover';
	import type { BlossomSource } from '$lib/ui/BlossomPopover/types';
	import { HUE_KEY, PALETTE_KEY } from './constants';
	import {
		lightnessArc,
		parseThemeColour,
		readThemeChange,
		selectedThemePetal,
		themePalette,
		themePetalHue,
		themePetals,
		themeValue
	} from './palette';
	import type { ThemeColourFieldProps } from './types';

	let { label, value, onchange, testId }: ThemeColourFieldProps = $props();
	const uid = $props.id();
	// The palette is fixed: what the library is handed is what the petals show.
	const petals = themePetals();
	const shown = themePalette();
	const colour = $derived(parseThemeColour(value));
	/** The text itself paints the swatch and the core once it reads as a colour; until then, the empty ring. */
	const swatch = $derived(colour === null ? null : value.trim());
	const selected = $derived(selectedThemePetal(colour));
	const flowerValue = $derived(themeValue(petals, colour));
	const arc = $derived(lightnessArc(colour));
	const words = $derived({
		group: t(PALETTE_KEY, { label }),
		petal: (index: number) => t(HUE_KEY, { h: themePetalHue(index) })
	});
	const pick = (change: BlossomColorPickerColor, source: BlossomSource): void => {
		const hex = readThemeChange(petals, change, colour, source);
		if (hex !== undefined) onchange(hex);
	};
</script>

<!-- A theme colour is picked on the same flower as a Scope's (owner review 2026-09-19, pack 3,
     P2), on Blossom's own model: the petals a fixed palette of 24 HSL hues, the arc the
     lightness ramp, the result the hex the library's maths give. The swatch opens it; the hex
     field beside stays for the exact value — greys and deep darks the flower cannot reach. -->
<div class="cg-label field" data-testid={testId}>
	<span>{label}</span>
	<span class="color-field">
		<BlossomPopover id={uid + '-flower'} {label} readout={value} colour={swatch} {testId}>
			<BlossomFlower
				{petals}
				{shown}
				value={flowerValue}
				{selected}
				{arc}
				colour={swatch}
				{words}
				onchange={pick}
				testId={testId ? `${testId}-blossom` : undefined}
			/>
		</BlossomPopover>
		<input
			class="cg-control cg-field"
			aria-label={label}
			{value}
			data-testid={testId ? `${testId}-hex` : undefined}
			oninput={(event) => onchange(event.currentTarget.value)}
		/>
	</span>
</div>

<style>
	.field {
		min-width: 0;
	}
	/* The dot and, beside it, the hex as text. */
	.color-field {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: calc(var(--cg-gap) * 0.75);
		align-items: center;
	}
</style>
