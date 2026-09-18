import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';

/**
 * Work of the Context that is already writing or reading what it wrote: a deletion, a
 * withdrawal, a correction, an inverse, the reading after any of them. Every command of the
 * Context goes through one place, so registering that place with the one exit gate is enough
 * for an app-owned reload — switching the DataSpace, opening a restored database, applying an
 * update — to wait for the write instead of racing it. It holds no input of its own, so it
 * never makes the gate ask anything.
 *
 * `pending` stands for everything accepted and not yet settled. Commands overlap — an offer is
 * installed before the reading that follows its command has finished, and the inverse may be
 * asked for during that reading — so the promise is not the last command's but one that
 * resolves when the count of running work returns to zero.
 */
class ContextWork {
	pending: Promise<void> | null = null;
	private running = 0;
	private settle: (() => void) | null = null;

	hold<T>(run: Promise<T>): Promise<T> {
		if (this.running === 0) {
			this.pending = new Promise<void>((resolve) => {
				this.settle = resolve;
			});
		}
		this.running += 1;
		const done = (): void => {
			this.running -= 1;
			if (this.running > 0) return;
			this.pending = null;
			const settle = this.settle;
			this.settle = null;
			settle?.();
		};
		run.then(done, done);
		return run;
	}
}

export const contextWork = new ContextWork();
draftGuard.watch(contextWork);
