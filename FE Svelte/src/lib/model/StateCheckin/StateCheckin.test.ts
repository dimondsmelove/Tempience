import { describe, expect, it } from 'vitest';
import { SCALE, WORDS } from './constants';
import { candidates, moodBand, quadrant } from './state';

describe('StateCheckin', () => {
	it('uses the source thresholds at every quadrant boundary', () => {
		expect(quadrant(3, 2)).toBe('Спокойная усталость');
		expect(quadrant(4, 2)).toBe('Спокойная энергия');
		expect(quadrant(3, 3)).toBe('Напряжённая усталость');
		expect(quadrant(4, 3)).toBe('Напряжённая энергия');
		expect(SCALE.map(moodBand)).toEqual([
			'неприятно',
			'неприятно',
			'нейтрально',
			'приятно',
			'приятно'
		]);
	});

	it('shows every quadrant word for all 125 answers, with stable mood ranking', () => {
		for (const energy of SCALE)
			for (const tension of SCALE)
				for (const mood of SCALE) {
					const actual = candidates(energy, tension, mood, Infinity);
					const source = WORDS.filter(([, q]) => q === quadrant(energy, tension));
					expect([...actual].sort()).toEqual(source.map(([word]) => word).sort());
					const band = moodBand(mood);
					const expected = [
						...source.filter(([, , tone]) => tone === band),
						...source.filter(([, , tone]) => tone !== band && tone === 'нейтрально'),
						...source.filter(([, , tone]) => tone !== band && tone !== 'нейтрально')
					].map(([word]) => word);
					expect(actual).toEqual(expected);
				}
	});
});
