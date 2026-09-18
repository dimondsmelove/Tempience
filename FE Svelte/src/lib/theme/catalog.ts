import tokens from '../../theme/tokens.generated.json';
import source from '../../theme/presets.source.json';
import { colorFields, metricFields } from './constants';
import type { Palette, Theme } from './types';

const metrics = Object.fromEntries(
	Object.entries(metricFields).map(([key, field]) => [key, field.value])
) as Theme['metrics'];
const palette = (mode: 'light' | 'dark'): Palette => {
	const values: Record<string, string> = tokens[mode];
	return Object.fromEntries(
		Object.entries(colorFields).map(([key, [, variable]]) => [
			key,
			values[variable] ??
				(key === 'input'
					? values['--cg-bg-raised']
					: key === 'secondary'
						? values['--cg-accent']
						: key === 'secondaryInk'
							? values['--cg-text-on-accent']
							: key === 'focus'
								? values['--cg-accent']
								: values['--cg-bg-surface'])
		])
	) as Palette;
};
export const baseline: Theme = {
	id: 'graphite',
	name: 'Графит · Tempience',
	formatVersion: 1,
	colors: { light: palette('light'), dark: palette('dark') },
	metrics,
	fonts: { ui: 'commissioner', mono: 'geist' }
};
// Graphite lifts the raised surface about 0.036 in luminance above the panel in
// both modes. tweakcn has no such role (its `muted` usually sits below `card`),
// so presets derive it from the panel; non-hex panels keep the panel colour.
const LIFT = 0.036;
const lift = (color: string): string => {
	const match = /^#([\da-f]{6})$/i.exec(color);
	if (!match) return color;
	const rgb = [0, 2, 4].map((i) => Number.parseInt(match[1].slice(i, i + 2), 16));
	const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
	const share = Math.min(1, LIFT / Math.max(0.001, 1 - luminance));
	return (
		'#' +
		rgb
			.map((c) =>
				Math.round(c + (255 - c) * share)
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
};
export const builtinThemes: readonly Theme[] = [
	baseline,
	...source.presets.map((preset): Theme => {
		const colors = { light: { ...baseline.colors.light }, dark: { ...baseline.colors.dark } };
		for (const mode of ['light', 'dark'] as const) {
			const values: Record<string, string | undefined> = preset.styles[mode];
			for (const [key, [, , input]] of Object.entries(colorFields)) {
				if (input && values[input]) colors[mode][key as keyof Palette] = values[input];
			}
			colors[mode].raised = lift(colors[mode].surface);
		}
		const radius = preset.styles.light.radius;
		const pixels = Number.parseFloat(radius) * (radius.endsWith('rem') ? 16 : 1);
		return {
			...baseline,
			id: 'preset:' + preset.id,
			name: preset.name,
			colors,
			metrics: {
				...metrics,
				controlRadius: Math.min(24, pixels),
				surfaceRadius: Math.min(32, pixels + 3)
			}
		};
	})
];
