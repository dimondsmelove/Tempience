<script lang="ts">
	import type {
		BlossomColorPickerColor,
		BlossomColorPickerOptions
	} from '@dayflow/blossom-color-picker';
	import '@dayflow/blossom-color-picker/styles.css';
	import { untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { MediaQuery } from 'svelte/reactivity';
	import {
		ARC_OFFSET,
		ARC_WIDTH,
		BAR_WIDTH,
		BLOOM_MS,
		CORE_SIZE,
		PETAL_SELECTOR,
		PETAL_SIZE
	} from './constants';
	import { decorateFlower } from './decorate';
	import { blossomGeometry } from './geometry';
	import { RingedBlossomColorPicker, type RingedHsl } from './rings';
	import type { BlossomFlowerProps, BlossomSource } from './types';

	let {
		petals,
		shown,
		value,
		selected,
		arc,
		colour,
		words,
		onchange,
		testId,
		petalSize = PETAL_SIZE
	}: BlossomFlowerProps = $props();
	// The palette as the library takes it: each petal's HSL with its ring, when the palette names rings.
	const colors = $derived(petals.map((petal): RingedHsl => ({ ...petal.hsl, ring: petal.ring })));
	const box = $derived(blossomGeometry(petals, petalSize));
	// The arc's gradient repainted by the caller's rule: one custom property per stop.
	const stops = $derived(arc.map((stop, k) => `--arc-${k}:${stop}`).join(';'));
	const reduced = new MediaQuery('(prefers-reduced-motion: reduce)');
	// Mounted folded and told to stay open a frame later: the bloom plays once, and nothing folds it again.
	let bloomed = $state(false);
	// Set inside the click that makes the library speak: its payload alone cannot tell a petal from the arc.
	let source: BlossomSource | null = null;
	const speak = (change: BlossomColorPickerColor): void => onchange(change, source ?? 'arc');
	const options = (): Partial<BlossomColorPickerOptions> => ({
		colors,
		value,
		showAlphaSlider: true,
		sliderPosition: 'right',
		adaptivePositioning: false,
		collapsible: !bloomed,
		initialExpanded: false,
		coreSize: CORE_SIZE,
		petalSize,
		circularBarWidth: BAR_WIDTH,
		sliderWidth: ARC_WIDTH,
		sliderOffset: ARC_OFFSET,
		animationDuration: reduced.current ? 0 : BLOOM_MS,
		onChange: speak
	});
	/** The library's picker, with our rings, mounted once and told of every change of its options. */
	const mount: Attachment<HTMLElement> = (node) => {
		const picker = new RingedBlossomColorPicker(node, untrack(options));
		$effect(() => picker.setOptions(options()));
		return () => picker.destroy();
	};
	const flower: Attachment<HTMLElement> = (node) => {
		// Capture names the source before the library's own listener speaks; bubble, after it, forgets.
		// (Not a microtask: a real click has an empty stack between listeners, and one would run early.)
		const classify = (event: Event): void => {
			source = (event.target as Element | null)?.closest?.(PETAL_SELECTOR) ? 'petal' : 'arc';
		};
		const forget = (): void => {
			source = null;
		};
		node.addEventListener('click', classify, true);
		node.addEventListener('click', forget);
		const frame = requestAnimationFrame(() => {
			bloomed = true;
		});
		const decorate = (): void => decorateFlower(node, petals, shown, selected, words, testId);
		// The library rebuilds its petals when the palette changes; the observer marks the new ones.
		const observer = new MutationObserver(decorate);
		observer.observe(node, { childList: true, subtree: true });
		$effect(decorate);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			node.removeEventListener('click', classify, true);
			node.removeEventListener('click', forget);
		};
	};
</script>

<!-- The Blossom flower as a skin (owner 2026-09-19): the library lays out the petals, the ring,
     the arc and the core, and speaks HSL — its `hue` is only a petal's name, its `hex` never
     drawn. The caller's model says what every petal shows, where the arc stands and what it
     means, and what the core holds; the skin repaints each library colour from that and the
     tokens. A palette that names its rings (the Scope's three depths, C6) is laid out in them. -->
<div
	class="flower"
	style={stops}
	style:--w="{box.width}px"
	style:--h="{box.height}px"
	style:--cx="{box.centreX}px"
	style:--cy="{box.centreY}px"
	style:--swatch={colour ?? 'var(--cg-bg-surface)'}
	style:--ring={colour ?? 'var(--cg-border-default)'}
	style:--tint={colour === null ? 'transparent' : `color-mix(in srgb, ${colour} 12%, transparent)`}
	data-empty={colour === null}
	data-testid={testId}
	{@attach flower}
>
	<div class="blossom-mount" {@attach mount}></div>
</div>

<style>
	/* The flower's box: the library blooms around the centre of a 32 px root and would overlay its
	   neighbours; the box reserves the flower and its arc, the root sits at the centre computed. */
	.flower {
		position: relative;
		width: var(--w);
		height: var(--h);
		max-width: 100%;
		overflow: hidden;
		isolation: isolate;
	}
	.blossom-mount {
		position: absolute;
		left: var(--cx);
		top: var(--cy);
		display: flex;
		transform: translate(-50%, -50%);
	}
	/* Graphite/Stone through the tokens: the library paints with inline styles and attributes, so
	   the skin is !important where it must be. The ground disc and its tint of the colour picked. */
	.flower :global(.bcp-bg-solid) {
		background-color: var(--cg-bg-raised) !important;
	}
	.flower :global(.bcp-bg-solid > div) {
		background-color: var(--tint) !important;
	}
	/* The core: the colour picked; without one, an empty ink ring as the ribbon's colourless mark. */
	.flower :global(.bcp-core) {
		background-color: var(--swatch) !important;
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--cg-text-primary) 25%, transparent) !important;
		transform: none !important;
	}
	.flower[data-empty='true'] :global(.bcp-core) {
		box-shadow: inset 0 0 0 var(--cg-border-width) var(--cg-text-primary) !important;
	}
	/* A petal shows what the model says it shows — `--petal` over the library's inline colour. */
	.flower :global(.bcp-petal-visible) {
		background-color: var(--petal) !important;
	}
	.flower :global(.bcp-petal:focus-visible) {
		outline: 2px solid var(--cg-focus) !important;
		outline-offset: 2px;
	}
	/* The current petal: lifted over its neighbours with the ink ring of the ribbon's selection. */
	.flower :global(.bcp-petal-visible[data-selected]) {
		z-index: 900 !important;
		box-shadow:
			0 0 0 2px var(--cg-bg-surface),
			0 0 0 3px var(--cg-text-primary) !important;
	}
	/* The colour ring around the petals: its ground the border, its colour the one picked. */
	.flower :global(.bcp-svg circle:not(.bcp-slider-handle):first-of-type) {
		stroke: var(--cg-border-default);
	}
	.flower :global(.bcp-svg circle:not(.bcp-slider-handle):last-of-type) {
		stroke: var(--ring);
	}
	/* The arc: the caller's ramp in eleven stops, its handle the colour picked. */
	.flower :global(.bcp-svg path:not(.bcp-slider-track)) {
		stroke: var(--cg-border-default);
	}
	.flower :global(.bcp-slider-handle) {
		fill: var(--swatch);
		stroke: var(--cg-bg-surface);
	}
	.flower :global(.bcp-svg stop:nth-child(1)) {
		stop-color: var(--arc-0);
	}
	.flower :global(.bcp-svg stop:nth-child(2)) {
		stop-color: var(--arc-1);
	}
	.flower :global(.bcp-svg stop:nth-child(3)) {
		stop-color: var(--arc-2);
	}
	.flower :global(.bcp-svg stop:nth-child(4)) {
		stop-color: var(--arc-3);
	}
	.flower :global(.bcp-svg stop:nth-child(5)) {
		stop-color: var(--arc-4);
	}
	.flower :global(.bcp-svg stop:nth-child(6)) {
		stop-color: var(--arc-5);
	}
	.flower :global(.bcp-svg stop:nth-child(7)) {
		stop-color: var(--arc-6);
	}
	.flower :global(.bcp-svg stop:nth-child(8)) {
		stop-color: var(--arc-7);
	}
	.flower :global(.bcp-svg stop:nth-child(9)) {
		stop-color: var(--arc-8);
	}
	.flower :global(.bcp-svg stop:nth-child(10)) {
		stop-color: var(--arc-9);
	}
	.flower :global(.bcp-svg stop:nth-child(11)) {
		stop-color: var(--arc-10);
	}
	@media (prefers-reduced-motion: reduce) {
		.flower :global(*) {
			transition: none !important;
		}
	}
</style>
