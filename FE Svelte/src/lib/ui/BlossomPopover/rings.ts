import {
	BlossomColorPicker,
	DEFAULT_COLORS,
	calculateBarRadius,
	calculateContainerSize,
	calculateLayerRadii,
	calculateLayerRotations,
	organizeColorsIntoLayers,
	parseColor,
	type BlossomColorPickerOptions,
	type ColorInput
} from '@dayflow/blossom-color-picker';
import { BAR_GAP } from './constants';
import type { Hsl } from './types';

/** An HSL colour handed to the library with the ring it belongs to, 0 the innermost. */
export type RingedHsl = Hsl & Readonly<{ ring?: number }>;

/** A palette names its rings when every colour carries one. */
export const isRinged = (colours: readonly RingedHsl[]): boolean =>
	colours.length > 0 && colours.every((colour) => colour.ring !== undefined);

/**
 * The rings of a palette. The library sorts petals by HSL lightness into rings of fixed
 * proportions by count (two up to 24 petals, four from 43 — 7 / 14 / 21 / 30 for 72), so no
 * lightness can make three rings of 24: a palette that names its rings gets them as named —
 * by number, inner first, each in the order handed (a hue circle); any other palette gets the
 * library's own.
 */
export const layersOf = (colours: readonly RingedHsl[]): RingedHsl[][] => {
	if (!isRinged(colours)) return organizeColorsIntoLayers([...colours]);
	const rings = new Map<number, RingedHsl[]>();
	for (const colour of colours) {
		const ring = rings.get(colour.ring!);
		if (ring) ring.push(colour);
		else rings.set(colour.ring!, [colour]);
	}
	return [...rings.entries()].sort(([a], [b]) => a - b).map(([, ring]) => ring);
};

/** The layout the library computes for itself, as its private fields hold it at run time. */
type Layout = {
	opts: Required<
		Pick<
			BlossomColorPickerOptions,
			| 'colors'
			| 'coreSize'
			| 'petalSize'
			| 'circularBarWidth'
			| 'showAlphaSlider'
			| 'sliderOffset'
			| 'sliderWidth'
		>
	>;
	normalizedColors: RingedHsl[];
	layers: RingedHsl[][];
	allColors: RingedHsl[];
	layerPrefixCounts: number[];
	layerRadii: number[];
	layerRotations: number[];
	barRadius: number;
	containerSize: number;
};

/**
 * Each ring turned to sit in the valleys of the ring before it — half a petal's pitch on from
 * that ring's own turn. (The library turns every ring by half the pitch of the one before,
 * without carrying the turns on: rings of one count, as ours, would then all stand on the
 * spokes of the second, each petal's centre under the ring inside it and out of reach.)
 */
export const ringRotations = (layers: readonly (readonly unknown[])[]): number[] =>
	layers.map((_, i) =>
		layers.slice(0, i).reduce((turn, ring) => turn + 180 / Math.max(1, ring.length), 0)
	);

/**
 * The library's `computeLayout` with our rings: the same maths (its exported helpers) with
 * `layersOf` in place of its lightness sort and `ringRotations` in place of its turns.
 */
function computeRingedLayout(this: Layout): void {
	const colours: ColorInput[] = this.opts.colors;
	this.normalizedColors =
		colours.length > 0 ? colours.map((colour) => parseColor(colour)) : [...DEFAULT_COLORS];
	const ringed = isRinged(this.normalizedColors);
	this.layers = layersOf(this.normalizedColors);
	this.allColors = this.layers.flat();
	this.layerPrefixCounts = [0];
	for (let i = 1; i < this.layers.length; i++)
		this.layerPrefixCounts.push(this.layerPrefixCounts[i - 1] + this.layers[i - 1].length);
	this.layerRadii = calculateLayerRadii(this.layers, this.opts.coreSize, this.opts.petalSize);
	this.layerRotations = ringed ? ringRotations(this.layers) : calculateLayerRotations(this.layers);
	this.barRadius = calculateBarRadius(
		this.layerRadii,
		this.opts.petalSize,
		this.opts.coreSize,
		BAR_GAP
	);
	this.containerSize = calculateContainerSize(
		this.barRadius,
		this.opts.circularBarWidth,
		this.opts.showAlphaSlider,
		this.opts.sliderOffset,
		this.opts.sliderWidth
	);
}

/**
 * The library's picker with rings of our naming (`RingedHsl.ring`): a palette without them
 * blooms exactly as the library lays it out. The library declares `computeLayout` private; at
 * run time it is a prototype method its constructor and `setOptions` call, replaced here.
 */
export class RingedBlossomColorPicker extends BlossomColorPicker {}
Object.defineProperty(RingedBlossomColorPicker.prototype, 'computeLayout', {
	value: computeRingedLayout,
	writable: true,
	configurable: true
});
