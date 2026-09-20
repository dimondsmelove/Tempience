import { calculateBarRadius, calculateLayerRadii } from '@dayflow/blossom-color-picker';
import { ARC_OFFSET, ARC_WIDTH, BAR_GAP, BAR_WIDTH, CORE_SIZE, PETAL_SIZE } from './constants';
import { layersOf } from './rings';
import type { Petal } from './types';

/** The box the flower needs: its diameter, the arc's reach to the right of the centre, and the centre. */
export type BlossomGeometry = Readonly<{
	/** The colour ring's svg: the flower's diameter. */
	flower: number;
	/** The arc slider's radius from the centre: where a spec clicks it, at −30° … +30° for 0 … 100. */
	arcRadius: number;
	/** From the centre to the far edge of the arc slider's svg. */
	arcReach: number;
	width: number;
	height: number;
	centreX: number;
	centreY: number;
}>;

/**
 * The library lays the flower out around the centre of a 32 px root and lets it overlay its
 * neighbours; the shell reserves this box instead and centres the root in it, so the bloom
 * stays inside its panel. The maths are the library's own (`calculateLayerRadii`,
 * `calculateBarRadius`) over our rings (`layersOf`), the svg paddings its renderers'.
 */
export const blossomGeometry = (
	petals: readonly Petal[],
	petalSize: number = PETAL_SIZE
): BlossomGeometry => {
	const layers = layersOf(petals.map((petal) => ({ ...petal.hsl, ring: petal.ring })));
	const radii = calculateLayerRadii(layers, CORE_SIZE, petalSize);
	const bar = calculateBarRadius(radii, petalSize, CORE_SIZE, BAR_GAP);
	const flower = (bar + BAR_WIDTH / 2) * 2 + 4;
	const arcRadius = bar + ARC_OFFSET;
	const arcReach = arcRadius + ARC_WIDTH / 2 + ARC_WIDTH + 10;
	return {
		flower,
		arcRadius,
		arcReach,
		width: flower / 2 + arcReach,
		height: flower,
		centreX: flower / 2,
		centreY: flower / 2
	};
};

/** The petals of a palette as the library rings them: the lighter share inside, the rest outside. */
export const ringPetals = (hexes: readonly string[], hsl: readonly Petal['hsl'][]): Petal[] => {
	// The library sorts petals by HSL lightness into rings; the first ring is the inner one.
	const inner = layersOf([...hsl])[0] ?? [];
	return hexes.map((hex, index) => ({
		index,
		hex,
		hsl: hsl[index],
		layer: inner.includes(hsl[index]) ? 'inner' : 'outer'
	}));
};

/**
 * The petals of a palette in rings of the caller's naming: `ring(index)` is 0 for the
 * innermost. The library's `layer` is `inner` for ring 0 and `outer` for the rest.
 */
export const ringedPetals = (
	hexes: readonly string[],
	hsl: readonly Petal['hsl'][],
	ring: (index: number) => number
): Petal[] =>
	hexes.map((hex, index) => {
		const own = ring(index);
		return { index, hex, hsl: hsl[index], layer: own === 0 ? 'inner' : 'outer', ring: own };
	});
