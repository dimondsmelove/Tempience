import { hexToHsl, lightnessToSliderValue } from '@dayflow/blossom-color-picker';
import { expect, it } from 'vitest';
import { translate } from '$lib/state/Locale/messages';
import { scopeBase, scopeColour } from '$lib/theme/scope-colour';
import { ARC_STOPS, PETAL_SIZE } from '$lib/ui/BlossomPopover/constants';
import { layersOf } from '$lib/ui/BlossomPopover/rings';
import {
	FLOWER_PETALS,
	IDENTITY_STEP,
	PETAL_COUNT,
	PETAL_HUES,
	PETAL_STEP,
	RING_COUNT,
	SHOW_EXACT_CONTROLS
} from './constants';
import {
	blossomGeometry,
	blossomPalette,
	blossomPetals,
	blossomValue,
	nearestPetal,
	petalAt,
	petalDepth,
	petalHue,
	readBlossomChange,
	saturationArc
} from './palette';
import { colourReadout, dotName, petalName } from './words';

const modes = ['dark', 'light'] as const;
const petals = blossomPetals();

it('lays seventy-two petals — twenty-four hues 15° apart in three rings, one per depth — each the colour the ribbon draws on the ground at the saturation chosen', () => {
	expect(PETAL_COUNT).toBe(24);
	expect(PETAL_STEP).toBe(15);
	expect(RING_COUNT).toBe(3);
	expect(FLOWER_PETALS).toBe(72);
	expect(PETAL_HUES[0]).toBe(0);
	expect(PETAL_HUES.at(-1)).toBe(345);
	expect(petalHue(14)).toBe(210);
	expect(petalHue(38)).toBe(210);
	expect(petalDepth(14)).toBe(0);
	expect(petalDepth(38)).toBe(1);
	expect(petalDepth(62)).toBe(2);
	expect(petalAt(14, 2)).toBe(62);
	for (const mode of modes) {
		const palette = blossomPalette(mode, null);
		expect(palette).toHaveLength(72);
		for (let index = 0; index < 72; index++)
			expect(palette[index]).toBe(scopeColour(petalHue(index), null, mode, petalDepth(index)));
		expect(blossomPalette(mode, 20)[38]).toBe(scopeColour(210, 20, mode, 1));
	}
	expect(blossomPalette('dark', null)).not.toEqual(blossomPalette('light', null));
	// A theme's own base paints the petals too: on a pale canvas the light ring is deeper.
	const pale = scopeBase('#D9D3C7');
	expect(blossomPalette(pale, null)[14]).toBe(scopeColour(210, null, pale, 0));
	expect(blossomPalette(pale, null)[14]).not.toBe(blossomPalette('light', null)[14]);
});

it('hands the library one fixed palette, every petal a distinct HSL hue — the name the library knows a petal by — ringed by depth', () => {
	expect(IDENTITY_STEP).toBe(5);
	expect(petals).toHaveLength(72);
	expect(new Set(petals.map((petal) => petal.hsl.h)).size).toBe(72);
	expect(petals[38]).toMatchObject({ index: 38, hue: 210, depth: 1, ring: 1, layer: 'outer' });
	expect(petals[14]).toMatchObject({ index: 14, hue: 210, depth: 0, ring: 0, layer: 'inner' });
	expect(petals[38].hsl).toEqual({ h: 190, s: 70, l: 55 });
	expect(hexToHsl(petals[38].hex).h).toBe(190);
	// Three pure rings of twenty-four, the light ring innermost, the deep ring outermost.
	const rings = layersOf(petals.map((petal) => ({ ...petal.hsl, ring: petal.ring })));
	expect(rings.map((ring) => ring.length)).toEqual([24, 24, 24]);
	rings.forEach((ring, depth) =>
		expect(ring.map((colour) => petalDepth(colour.h / IDENTITY_STEP))).toEqual(
			Array.from({ length: 24 }, () => depth)
		)
	);
	// The same in both modes and at every saturation: the library never rebuilds the flower.
	expect(blossomPetals()).toEqual(petals);
});

it('finds the nearest petal for any degree at a depth, folding the top of the circle onto the first of the ring', () => {
	expect(nearestPetal(0)).toBe(0);
	expect(nearestPetal(210)).toBe(14);
	expect(nearestPetal(267)).toBe(18);
	expect(nearestPetal(7)).toBe(0);
	expect(nearestPetal(8)).toBe(1);
	expect(nearestPetal(353)).toBe(0);
	expect(nearestPetal(352)).toBe(23);
	expect(nearestPetal(210, 1)).toBe(38);
	expect(nearestPetal(352, 2)).toBe(71);
	expect(nearestPetal(353, 2)).toBe(48);
	expect(nearestPetal(210, null)).toBe(14);
	expect(nearestPetal(210, 5)).toBe(14);
});

it('shows the colour as the nearest petal of its depth with the arc at the saturation, and a neutral first petal without a hue', () => {
	expect(blossomValue(petals, 267, 60, 2)).toEqual({
		hue: petals[66].hsl.h,
		saturation: 60,
		lightness: petals[66].hsl.l,
		originalSaturation: petals[66].hsl.s,
		alpha: 100,
		layer: 'outer'
	});
	expect(blossomValue(petals, 267, 60)).toMatchObject({ hue: petals[18].hsl.h, layer: 'inner' });
	expect(blossomValue(petals, 210, null).saturation).toBe(100);
	expect(blossomValue(petals, null, null)).toMatchObject({ hue: petals[0].hsl.h, saturation: 100 });
});

it('maps a petal click to our hue and depth with the saturation kept, and an arc move to our saturation with the hue and the depth kept', () => {
	const petal = petals[38];
	// A petal click: the library says the petal's HSL hue and a slider position from its lightness.
	const click = { hue: petal.hsl.h, saturation: lightnessToSliderValue(petal.hsl.l) };
	expect(readBlossomChange(petals, click, { hue: 30, chroma: 40, depth: 0 }, 'petal')).toEqual({
		hue: 210,
		chroma: 40,
		depth: 1
	});
	expect(readBlossomChange(petals, click, { hue: null, chroma: null }, 'petal')).toEqual({
		hue: 210,
		chroma: null,
		depth: 1
	});
	expect(
		readBlossomChange(petals, { hue: 999, saturation: 10 }, { hue: 30, chroma: 40 }, 'petal')
	).toBeUndefined();
	// The arc: its position is the saturation; without a hue it picks nothing, as the disabled range.
	expect(
		readBlossomChange(
			petals,
			{ hue: petal.hsl.h, saturation: 73 },
			{ hue: 210, chroma: 40, depth: 2 },
			'arc'
		)
	).toEqual({ hue: 210, chroma: 73, depth: 2 });
	expect(
		readBlossomChange(
			petals,
			{ hue: petal.hsl.h, saturation: 73.4 },
			{ hue: 267, chroma: null },
			'arc'
		)
	).toEqual({ hue: 267, chroma: 73, depth: 0 });
	expect(
		readBlossomChange(
			petals,
			{ hue: petal.hsl.h, saturation: 73 },
			{ hue: null, chroma: null },
			'arc'
		)
	).toBeUndefined();
});

it('reserves one box whatever the theme, one that fits the phone popover at 390 px', () => {
	const box = blossomGeometry(petals);
	expect(box.width).toBeLessThan(360);
	expect(box.flower).toBeGreaterThan(box.arcRadius);
	expect(blossomGeometry(petals, PETAL_SIZE)).toEqual(box);
	expect(blossomGeometry(petals, 28).width).toBeLessThan(box.width);
});

it('paints the arc as the saturation 0–100 of the hue chosen at its depth, and grey without a hue', () => {
	const arc = saturationArc(210, 'dark', 2);
	expect(arc).toHaveLength(ARC_STOPS);
	expect(arc[0]).toBe(scopeColour(210, 0, 'dark', 2));
	expect(arc[5]).toBe(scopeColour(210, 50, 'dark', 2));
	expect(arc.at(-1)).toBe(scopeColour(210, 100, 'dark', 2));
	expect(saturationArc(210, 'dark')).toEqual(saturationArc(210, 'dark', 0));
	expect(new Set(saturationArc(null, 'light'))).toEqual(new Set(['var(--cg-border-default)']));
});

it('says the colour for readers in both languages, and names the Context dot by it or as the way to set one', () => {
	const ru = translate.bind(null, 'ru');
	const en = translate.bind(null, 'en');
	expect(colourReadout(ru, 25, 60, 2)).toBe('Оттенок 25° · глубина 2 · насыщенность 60');
	expect(colourReadout(ru, 25, null, null)).toBe('Оттенок 25° · глубина 0 · насыщенность 100');
	expect(colourReadout(ru, null, 60, 2)).toBe('Без цвета');
	expect(colourReadout(en, 25, 60, 2)).toBe('Hue 25° · depth 2 · saturation 60');
	expect(colourReadout(en, null, null, null)).toBe('No colour');
	expect(dotName(ru, 25, 60, 2)).toBe('Цвет Scope: Оттенок 25° · глубина 2 · насыщенность 60');
	expect(dotName(ru, null, null, null)).toBe('Задать цвет Scope');
	expect(dotName(en, 210, null, 1)).toBe('Scope colour: Hue 210° · depth 1 · saturation 100');
	expect(dotName(en, null, null, null)).toBe('Set the Scope colour');
	expect(petalName(ru, 210, 1)).toBe('Оттенок 210° · глубина 1');
	expect(petalName(en, 345, 2)).toBe('Hue 345° · depth 2');
});

it('keeps the exact controls off the screen, as the owner asked (pack 3, P1)', () => {
	expect(SHOW_EXACT_CONTROLS).toBe(false);
});
