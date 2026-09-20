import { describe, expect, it } from 'vitest';
import { TourState } from './Tour.svelte';

describe('tour overlay state', () => {
	it('starts closed, opens and closes, also through detached callbacks', () => {
		const state = new TourState();
		expect(state.open).toBe(false);
		const { show, hide } = state;
		show();
		expect(state.open).toBe(true);
		hide();
		expect(state.open).toBe(false);
	});
});
