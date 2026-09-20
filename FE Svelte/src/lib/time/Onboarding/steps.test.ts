import { describe, expect, it } from 'vitest';
import { hasMessage } from '$lib/state/Locale/messages';
import { ONBOARDING_STEPS } from './constants';
import { STEP_TITLE_KEY, paragraphKeys } from './steps';

describe('tour screens', () => {
	it('give every explaining screen its copy, and the last one none', () => {
		for (const step of ONBOARDING_STEPS) {
			expect(hasMessage(STEP_TITLE_KEY[step]), step).toBe(true);
			const keys = paragraphKeys(step);
			if (step === 'try') expect(keys).toEqual([]);
			else expect(keys.length, step).toBeGreaterThan(0);
			for (const key of keys) expect(hasMessage(key), String(key)).toBe(true);
		}
	});

	it('never repeats a paragraph across screens', () => {
		const all = ONBOARDING_STEPS.flatMap((step) => paragraphKeys(step));
		expect(new Set(all).size).toBe(all.length);
	});
});
