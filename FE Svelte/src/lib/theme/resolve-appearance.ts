import tokens from '../../theme/tokens.generated.json';
import { colorFields, monoFonts, uiFonts } from './constants';
import type { DeviceAppearance, Theme } from './types';
import type { ResolvedTheme } from './resolve-theme';

export function resolveAppearance(
	theme: Theme,
	device: DeviceAppearance,
	mode: ResolvedTheme
): Record<string, string> {
	const m = theme.metrics,
		scale = device.textScale,
		density = device.density;
	const rem = (px: number) => `${px / 16}rem`;
	const values: Record<string, string> = { ...tokens.common, ...tokens[mode] };
	for (const [key, [, variable]] of Object.entries(colorFields)) {
		values[variable] = theme.colors[mode][key as keyof typeof colorFields];
	}
	values['--cg-bg-inverse'] = theme.colors[mode === 'light' ? 'dark' : 'light'].canvas;
	values['--cg-text-inverse'] = theme.colors[mode === 'light' ? 'dark' : 'light'].ink;
	values['--cg-font-sans'] = uiFonts[theme.fonts.ui].css;
	values['--cg-font-mono'] = monoFonts[theme.fonts.mono].css;
	for (const role of ['caption', 'control', 'body', 'section', 'screen'] as const) {
		values[`--cg-text-size-${role}`] = rem(m[role] * scale);
	}
	Object.assign(values, {
		'--cg-text-size-body-sm': rem(m.control * scale),
		'--text-xs': rem(m.caption * scale),
		'--text-sm': rem(m.body * scale),
		'--text-base': rem((m.body + 2) * scale),
		'--text-lg': rem(m.section * scale),
		'--text-xl': rem((m.section + 2) * scale),
		'--text-2xl': rem(m.screen * scale),
		'--cg-radius-control': rem(m.controlRadius),
		'--cg-radius-surface': rem(m.surfaceRadius),
		'--cg-radius-sm': rem(m.controlRadius),
		'--cg-radius-md': rem(m.surfaceRadius),
		'--cg-control-padding-x': rem(m.paddingX * density),
		'--cg-control-padding-y': rem(m.paddingY * density),
		'--cg-panel-padding': rem(m.panelPadding * density),
		'--cg-gap': rem(m.gap * density),
		'--cg-border-width': rem(m.borderWidth),
		'--cg-shadow': `0 ${rem(m.shadow / 4)} ${rem(m.shadow)} color-mix(in srgb, ${theme.colors[mode].ink} 16%, transparent)`,
		'--cg-line-height': String(m.lineHeight),
		'--cg-text-weight-regular': String(m.weight),
		'--cg-control-height': rem(
			Math.max(
				32 * scale * density,
				m.control * scale * 1.3 + 2 * m.paddingY * density + 2 * m.borderWidth
			)
		),
		'--cg-control-height-sm': rem(
			Math.max(
				28 * scale * density,
				m.caption * scale * 1.3 + (m.paddingY * density * 5) / 3 + 2 * m.borderWidth
			)
		),
		'--cg-axis-major': rem(m.axisMajor * scale),
		'--cg-axis-minor': rem(m.axisMinor * scale),
		'--cg-axis-week': rem(m.axisWeek * scale),
		'--cg-axis-height': rem(
			44 * scale * Math.max(m.axisMajor / 12, m.axisMinor / 11, m.axisWeek / 10)
		)
	});
	for (const n of [1, 2, 3, 4, 6, 8]) values[`--cg-space-${n}`] = rem(n * 4 * density);
	return values;
}

export const appearanceStyle = (values: Record<string, string>): string =>
	Object.entries(values)
		.map(([key, value]) => `${key}:${value}`)
		.join(';');

export function panelWidths(width: number, device: DeviceAppearance) {
	const context = device.contextOpen
		? Math.min(device.contextWidth, Math.max(240, width * 0.42))
		: 0;
	const rail = device.railOpen
		? Math.min(device.railWidth, Math.max(120, width - context - 280))
		: 0;
	return { context, rail };
}
