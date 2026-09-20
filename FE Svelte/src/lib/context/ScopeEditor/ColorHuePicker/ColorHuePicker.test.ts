import { expect, it } from 'vitest';
import { scopeColour } from '$lib/theme/scope-colour';
import { chromaBarGradient, hueBarGradient } from './ColorHuePicker';
import { BAR_STOP_DEG, CHROMA_STOP_PERCENT, HUE_MAX, HUE_MIN } from './constants';

const stopsOf = (value: string): string[] => {
	expect(value.startsWith('linear-gradient(to right, ')).toBe(true);
	return value.slice('linear-gradient(to right, '.length, -1).split(', ');
};

it('draws the hue bar as the circle in the colours of the mode at the saturation chosen, closing on itself', () => {
	const dark = hueBarGradient(null, 'dark');
	const stops = stopsOf(dark);
	expect(stops).toHaveLength(360 / BAR_STOP_DEG + 1);
	expect(stops[0]).toBe(`${scopeColour(0, null, 'dark')} 0.00%`);
	expect(stops.at(-1)).toBe(`${scopeColour(0, null, 'dark')} 100.00%`);
	expect(stops[360 / BAR_STOP_DEG / 2]).toBe(`${scopeColour(180, null, 'dark')} 50.00%`);
	expect(hueBarGradient(null, 'light')).not.toBe(dark);
	expect(hueBarGradient(null, 'light')).toContain(scopeColour(180, null, 'light'));
	// A lower saturation paints the whole bar paler.
	expect(stopsOf(hueBarGradient(20, 'dark'))[0]).toBe(`${scopeColour(0, 20, 'dark')} 0.00%`);
});

it('draws the saturation bar of the hue chosen from pastel to vivid', () => {
	const stops = stopsOf(chromaBarGradient(210, 'light'));
	expect(stops).toHaveLength(100 / CHROMA_STOP_PERCENT + 1);
	expect(stops[0]).toBe(`${scopeColour(210, 0, 'light')} 0%`);
	expect(stops.at(-1)).toBe(`${scopeColour(210, 100, 'light')} 100%`);
	expect(chromaBarGradient(210, 'dark')).not.toBe(chromaBarGradient(210, 'light'));
});

it('spans whole degrees 0–359, the step of the arrows', () => {
	expect(HUE_MIN).toBe(0);
	expect(HUE_MAX).toBe(359);
});
