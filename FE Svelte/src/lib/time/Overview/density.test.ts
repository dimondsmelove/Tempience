import { describe, expect, it } from 'vitest';
import { densityBins, spanReadout, stripRange } from './density';

const DAY = 86_400_000;

describe('densityBins', () => {
	it('counts records per bin, spreads intervals and normalises by the fullest bin', () => {
		const range = { start: 0, end: 10 * DAY };
		const bins = densityBins(
			[
				{ start: 1 * DAY, end: 1 * DAY },
				{ start: 1.5 * DAY, end: 1.5 * DAY },
				{ start: 6 * DAY, end: 8.5 * DAY },
				{ start: 40 * DAY, end: 41 * DAY }
			],
			range,
			10
		);
		expect([...bins]).toEqual([0, 1, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0]);
	});

	it('returns zeros for an empty range', () => {
		expect([...densityBins([{ start: 0, end: 1 }], { start: 5, end: 5 }, 4)]).toEqual([0, 0, 0, 0]);
	});
});

describe('stripRange and spanReadout', () => {
	it('pads the extent and keeps the window inside the strip', () => {
		const fallback = { start: 100 * DAY, end: 200 * DAY };
		expect(stripRange(null, fallback)).toEqual(fallback);
		const padded = stripRange({ start: 0, end: 100 * DAY }, fallback);
		expect(padded).toEqual({ start: -8 * DAY, end: 208 * DAY });
		expect(spanReadout(240 * DAY)).toBe('≈ 240 дн');
		expect(spanReadout(3 * 365 * DAY)).toBe('≈ 3 г');
		expect(spanReadout(2.5 * 365 * DAY)).toBe('≈ 2.5 г');
	});
});
