import type { ResolvedTheme, ThemePreference } from './resolve-theme';
import type { colorFields, metricFields, uiFonts, monoFonts } from './constants';

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
};
export type AppearanceDefaults = { themeId: string; mode: ThemePreference };
