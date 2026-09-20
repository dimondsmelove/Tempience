import { hexToHsl, hslToHex } from '@dayflow/blossom-color-picker';
import { describe, expect, it } from 'vitest';
import { ARC_OFFSET, ARC_WIDTH, BAR_WIDTH } from './constants';
import { petalByBlossomHue } from './decorate';
import { blossomGeometry, ringPetals } from './geometry';

/** Twenty-four hues 15° apart at one saturation and lightness — a palette the shell knows nothing about. */
const hexes = Array.from({ length: 24 }, (_, i) => hslToHex(i * 15, 70, 55));
const petals = ringPetals(hexes, hexes.map(hexToHsl));

describe('ringPetals', () => {
	it('numbers the petals by index, keeps the hex handed to the library and rings them as it does', () => {
		expect(petals).toHaveLength(24);
		expect(petals[14]).toMatchObject({ index: 14, hex: hexes[14], hsl: hexToHsl(hexes[14]) });
		// Two rings: the library takes 35 % (eight) inside, the rest outside.
		expect(petals.filter((petal) => petal.layer === 'inner')).toHaveLength(8);
		expect(petals.filter((petal) => petal.layer === 'outer')).toHaveLength(16);
		expect(new Set(petals.map((petal) => petal.hsl.h)).size).toBe(24);
	});

	it('finds a petal by the HSL hue the library names it with', () => {
		expect(petalByBlossomHue(petals, petals[5].hsl.h)).toBe(petals[5]);
		expect(petalByBlossomHue(petals, 999)).toBeUndefined();
	});
});

describe('blossomGeometry', () => {
	it('reserves a box of the flower plus its arc to the right, centred on the flower', () => {
		const box = blossomGeometry(petals);
		expect(box.flower).toBeGreaterThan(160);
		expect(box.flower).toBeLessThan(200);
		expect(box.height).toBe(box.flower);
		expect(box.centreX).toBe(box.flower / 2);
		expect(box.width).toBe(box.flower / 2 + box.arcReach);
		expect(box.arcRadius).toBe((box.flower - 4) / 2 - BAR_WIDTH / 2 + ARC_OFFSET);
		expect(box.arcReach).toBeGreaterThan(box.arcRadius + ARC_WIDTH);
		// The box fits a popover on the phone at 390 px.
		expect(box.width).toBeLessThan(300);
	});
});
