import {
	colorFields,
	defaultDevice,
	rowHeightBounds,
	metricFields,
	monoFonts,
	uiFonts
} from './constants';
import type { DeviceAppearance, Theme } from './types';

const record = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const number = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)';
const channel = number + '%?';
const hue = number + '(?:deg)?';
const color = (value: unknown): value is string => {
	if (typeof value !== 'string' || value.length >= 120) return false;
	if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return true;
	const match = /^(rgb|rgba|hsl|hsla|oklch|oklab)\((.+)\)$/i.exec(value);
	if (!match) return false;
	const fn = match[1].toLowerCase();
	const channels = fn.startsWith('hsl')
		? [hue, number + '%', number + '%']
		: fn === 'oklch'
			? [channel, channel, hue]
			: [channel, channel, channel];
	const modern = channels.join('\\s+') + '(?:\\s*/\\s*' + channel + ')?';
	const legacy = channels.join('\\s*,\\s*') + '(?:\\s*,\\s*' + channel + ')?';
	return new RegExp(
		'^\\s*(?:' + modern + (fn.startsWith('ok') ? '' : '|' + legacy) + ')\\s*$'
	).test(match[2]);
};
const mode = (value: unknown) => value === 'light' || value === 'dark' || value === 'system';
const finite = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

export function parseTheme(value: unknown): Theme | null {
	if (
		!record(value) ||
		value.formatVersion !== 1 ||
		typeof value.id !== 'string' ||
		!value.id ||
		value.id.length > 100 ||
		typeof value.name !== 'string' ||
		!value.name.trim() ||
		value.name.length > 80 ||
		!record(value.colors) ||
		!record(value.metrics) ||
		!record(value.fonts)
	)
		return null;
	for (const scheme of ['light', 'dark']) {
		const palette = value.colors[scheme];
		if (!record(palette) || !Object.keys(colorFields).every((key) => color(palette[key])))
			return null;
	}
	for (const [key, field] of Object.entries(metricFields)) {
		if (!finite(value.metrics[key], field.min, field.max)) return null;
	}
	if (
		typeof value.fonts.ui !== 'string' ||
		!Object.hasOwn(uiFonts, value.fonts.ui) ||
		typeof value.fonts.mono !== 'string' ||
		!Object.hasOwn(monoFonts, value.fonts.mono)
	)
		return null;
	// Pick only owned fields so foreign CSS or future fields never enter the style adapter.
	return {
		id: value.id,
		name: value.name.trim(),
		formatVersion: 1,
		colors: Object.fromEntries(
			['light', 'dark'].map((scheme) => [
				scheme,
				Object.fromEntries(
					Object.keys(colorFields).map((key) => [
						key,
						(value.colors as Record<string, Record<string, unknown>>)[scheme][key]
					])
				)
			])
		) as Theme['colors'],
		metrics: Object.fromEntries(
			Object.keys(metricFields).map((key) => [key, (value.metrics as Record<string, unknown>)[key]])
		) as Theme['metrics'],
		fonts: { ui: value.fonts.ui, mono: value.fonts.mono } as Theme['fonts']
	};
}
export function parseDevice(value: unknown): DeviceAppearance | null {
	if (
		!record(value) ||
		value.formatVersion !== 1 ||
		!(value.themeId === null || typeof value.themeId === 'string') ||
		!(value.mode === null || mode(value.mode)) ||
		!finite(value.textScale, 0.8, 1.5) ||
		!finite(value.density, 0.75, 1.5) ||
		(value.rowHeightPx !== undefined &&
			!finite(value.rowHeightPx, rowHeightBounds.min, rowHeightBounds.max)) ||
		!finite(value.railWidth, 120, 480) ||
		!finite(value.contextWidth, 240, 600) ||
		typeof value.railOpen !== 'boolean' ||
		typeof value.contextOpen !== 'boolean'
	)
		return null;
	return Object.fromEntries(
		Object.keys(defaultDevice).map((key) => [
			key,
			key === 'rowHeightPx' ? (value[key] ?? defaultDevice.rowHeightPx) : value[key]
		])
	) as DeviceAppearance;
}
