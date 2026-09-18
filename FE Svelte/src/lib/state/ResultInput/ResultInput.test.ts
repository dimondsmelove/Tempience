import { beforeEach, describe, expect, it } from 'vitest';
import type { DataSpaceId } from '$lib/state/triplit/data-space';
import { ResultInputState } from './ResultInput.svelte';

/** Two spaces a user legitimately has: a restored backup keeps the ids of its original. */
const HERE = 'canonical' as DataSpaceId;
const THERE = 'imported:backup' as DataSpaceId;
/** The same record and the same link in both of them. */
const PLAN = 'trace-1';
const LINK = 'link-1';

let input: ResultInputState;
beforeEach(() => {
	input = new ResultInputState();
});

describe('unsent result input, by the space it was entered in', () => {
	it('shows one space only its own entered values', () => {
		input.set(HERE, PLAN, 'outcome', 'partial');
		input.set(HERE, PLAN, 'open', false);
		input.set(THERE, PLAN, 'outcome', 'completed');
		expect(input.for(HERE, PLAN)).toEqual({ outcome: 'partial', open: false });
		expect(input.for(THERE, PLAN)).toEqual({ outcome: 'completed' });
		expect([input.stated(HERE, PLAN), input.stated(THERE, PLAN)]).toEqual([true, true]);
		// A space that was never used for this record has nothing entered, not someone else's.
		expect(input.for('scenario' as DataSpaceId, PLAN)).toEqual({});
		expect(input.stated('scenario' as DataSpaceId, PLAN)).toBe(false);
	});

	it('keeps each space intact when the other is cleared', () => {
		input.set(HERE, PLAN, 'outcome', 'partial');
		input.set(THERE, PLAN, 'open', true);
		input.clear(THERE, PLAN);
		expect(input.for(HERE, PLAN)).toEqual({ outcome: 'partial' });
		expect(input.for(THERE, PLAN)).toEqual({});
		input.clear(HERE, PLAN);
		expect(input.stated(HERE, PLAN)).toBe(false);
	});

	it('answers one feature at a time without reading the other space', () => {
		input.set(HERE, PLAN, 'outcome', 'partial');
		input.set(THERE, PLAN, 'outcome', 'completed');
		// Taking a feature back leaves the rest of that space's input, and all of the other's.
		input.set(HERE, PLAN, 'outcome', undefined);
		expect(input.for(HERE, PLAN)).toEqual({});
		expect(input.for(THERE, PLAN)).toEqual({ outcome: 'completed' });
	});

	it('keeps a correction step inside the space that opened it', () => {
		input.openRetarget(THERE, LINK);
		input.search(THERE, 'план');
		// The same link id in another space is a different link: its step is not this one.
		expect(input.retargetFor(HERE, LINK)).toBeNull();
		expect(input.retargetFor(THERE, LINK)).toEqual({
			space: THERE,
			evidenceId: LINK,
			query: 'план'
		});
		// Neither a search nor a close from another space touches it.
		input.search(HERE, 'другое');
		input.closeRetarget(HERE);
		expect(input.retargetFor(THERE, LINK)).toMatchObject({ query: 'план' });
		input.closeRetarget(THERE);
		expect(input.retargetFor(THERE, LINK)).toBeNull();
	});

	it('holds one step at a time, as the one Context shows one', () => {
		input.openRetarget(HERE, LINK);
		input.openRetarget(HERE, 'link-2');
		expect(input.retargetFor(HERE, LINK)).toBeNull();
		expect(input.retargetFor(HERE, 'link-2')).toMatchObject({ query: '' });
	});

	it('counts a correction that says «nothing» as input a reload would take', () => {
		input.set(HERE, PLAN, 'outcome', null);
		// Clearing what a statement says is a correction the user prepared and has not sent…
		expect(input.for(HERE, PLAN)).toEqual({ outcome: null });
		expect(input.retained).toBe(true);
		// …and it is still not something a new direct statement could be made of.
		expect(input.stated(HERE, PLAN)).toBe(false);
		// Taking the feature back leaves nothing entered at all, and nothing to ask about.
		input.set(HERE, PLAN, 'outcome', undefined);
		expect([input.retained, input.stated(HERE, PLAN)]).toEqual([false, false]);
	});

	it('drops what a reload would take in every space at once, once the user says so', () => {
		input.set(HERE, PLAN, 'open', null);
		input.set(THERE, PLAN, 'outcome', 'partial');
		input.openRetarget(THERE, LINK);
		input.search(THERE, 'план');
		expect(input.retained).toBe(true);
		input.discardRetained();
		expect(input.retained).toBe(false);
		expect(input.for(HERE, PLAN)).toEqual({});
		expect(input.retargetFor(THERE, LINK)).toBeNull();
	});

	it('is busy while its command runs, and free again afterwards', async () => {
		let release = (): void => {};
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const held = input.hold(blocked.then(() => 'done'));
		expect(input.busy).toBe(true);
		release();
		expect(await held).toBe('done');
		expect(input.busy).toBe(false);
	});
});
