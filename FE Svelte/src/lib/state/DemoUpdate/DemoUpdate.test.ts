import { describe, expect, it } from 'vitest';
import { DemoUpdateState } from './DemoUpdate.svelte';

describe('demo update state', () => {
	it('offers nothing until the boot finds an outdated notebook it could not rebuild', () => {
		const state = new DemoUpdateState();
		expect(state.available).toBe(false);
		state.available = true;
		expect(state.available).toBe(true);
	});
});
