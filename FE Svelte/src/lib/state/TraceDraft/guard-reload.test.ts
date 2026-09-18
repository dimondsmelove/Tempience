import { describe, expect, it } from 'vitest';
import { DraftExitGuard, type PendingWork } from './guard.svelte';
import { flush } from './TraceDraft.fixture';

/** What a view keeps in memory between its own lifetimes, as the Context's result input does. */
const holder = (retained: boolean) => {
	const work = {
		pending: null as Promise<void> | null,
		retained,
		discarded: 0,
		discardRetained() {
			work.discarded += 1;
			work.retained = false;
		}
	};
	return work;
};

const answer = async (guard: DraftExitGuard, discard: boolean): Promise<void> => {
	await flush();
	expect(guard.request).not.toBeNull();
	if (discard) guard.discard();
	else guard.keep();
	await flush();
};

describe('exits that end what is only in memory', () => {
	it('asks nothing when nothing is held', async () => {
		const guard = new DraftExitGuard();
		guard.watch(holder(false));
		let left = 0;
		guard.exitReloading(() => {
			left += 1;
		});
		expect(left).toBe(1);
		expect(guard.request).toBeNull();
		await expect(guard.confirmReloading()).resolves.toBe(true);
	});

	it('keeps input and cancels the transition when the user keeps it', async () => {
		const guard = new DraftExitGuard();
		const work = holder(true);
		guard.watch(work);
		let left = 0;
		guard.exitReloading(() => {
			left += 1;
		});
		await answer(guard, false);
		expect(left).toBe(0);
		expect(work.retained).toBe(true);
		expect(work.discarded).toBe(0);
		expect(guard.request).toBeNull();
	});

	it('drops exactly what the reload would take, then goes on', async () => {
		const guard = new DraftExitGuard();
		const work = holder(true);
		guard.watch(work);
		let left = 0;
		guard.exitReloading(() => {
			left += 1;
		});
		await answer(guard, true);
		expect([left, work.discarded, work.retained]).toEqual([1, 1, false]);
	});

	it('leaves an ordinary in-app transition alone: nothing is lost by one', async () => {
		const guard = new DraftExitGuard();
		const work = holder(true);
		guard.watch(work);
		let left = 0;
		// Closing the Context, a tab, a width: the input survives all of them, so no question.
		guard.exit(() => {
			left += 1;
		});
		expect([left, guard.request, work.discarded]).toEqual([1, null, 0]);
		await expect(guard.confirm()).resolves.toBe(true);
		expect(work.retained).toBe(true);
	});

	it('waits for a command in flight before deciding whether anything is left to ask about', async () => {
		const guard = new DraftExitGuard();
		let release = (): void => {};
		const running = new Promise<void>((resolve) => {
			release = resolve;
		});
		const work: PendingWork & { pending: Promise<void> | null; retained: boolean } = {
			pending: running,
			retained: true,
			discardRetained: () => {
				work.retained = false;
			}
		};
		guard.watch(work);
		let left = 0;
		guard.exitReloading(() => {
			left += 1;
		});
		await flush();
		// Nothing is asked while the command runs: it may take that very input.
		expect([left, guard.request]).toEqual([0, null]);
		// The command commits and takes what was entered, so there is nothing left to lose.
		work.retained = false;
		work.pending = null;
		release();
		await flush();
		expect([left, guard.request]).toEqual([1, null]);
	});
});
