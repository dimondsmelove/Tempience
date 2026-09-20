import type { ResolvedTheme, ThemePreference } from './resolve-theme';
import type { colorFields, metricFields, uiFonts, monoFonts } from './constants';
import type { RowArrangement } from '$lib/model/Arrangement/types';

export type ColorKey = keyof typeof colorFields;
export type MetricKey = keyof typeof metricFields;
export type Palette = Record<ColorKey, string>;
export type Theme = {
	id: string;
	name: string;
	formatVersion: 1;
	colors: Record<ResolvedTheme, Palette>;
	metrics: Record<MetricKey, number>;
	fonts: { ui: keyof typeof uiFonts; mono: keyof typeof monoFonts };
};
export type DeviceAppearance = {
	formatVersion: 1;
	themeId: string | null;
	mode: ThemePreference | null;
	textScale: number;
	density: number;
	rowHeightPx: number;
	railWidth: number;
	contextWidth: number;
	railOpen: boolean;
	contextOpen: boolean;
	/** The legend strip on the Time surface is shown; a view setting of this device (research п. 17). */
	legendOpen: boolean;
	/** The order and the sets of the ribbon rows on this device; `null` is the default order (research п. 7, Q3-A). */
	rowArrangement: RowArrangement | null;
	/** The lens (loop 008, B): the strength of the veil under a hover, 0–100; 0 turns the veil off. */
	lens: number;
};
export type AppearanceDefaults = { themeId: string; mode: ThemePreference };
