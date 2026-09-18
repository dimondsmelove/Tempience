import type { DataSpaceId } from '$lib/state/triplit/data-space';
import { UNDO_TTL_MS } from './constants';
import type { UndoOffer } from './types';

/**
 * One pending «Отменить» after an action that can be taken back (DESIGN.md §8, DP23). The
 * action itself is already written; the inverse is a new operation of its own, so the journal
 * keeps both steps. Exactly one offer stands at a time: a new one replaces the previous, the
 * offer fades on its own, and while a step runs neither a second press nor a replacement gets
 * past it.
 *
 * A refusal of the inverse and a reading that failed after it are different things and are
 * kept apart. Before the inverse commits, pressing again attempts the inverse. Once it has
 * committed, the action is taken back for good: what is left is showing it, which is what
 * pressing again then does. No path offers to write the inverse twice.
 */
export class UndoState {
	pending = $state.raw<UndoOffer | null>(null);
	/** A step is running: the offer stays and neither repeats nor is replaced. */
	busy = $state(false);
	/** The inverse of the pending offer has committed; only its reading is left. */
	inverted = $state(false);
	/** Why the last step did not finish; cleared by the next offer or by dismissing this one. */
	/** What the inverse refused with, or 'space' for an offer that outlived its data space. */
	failure = $state.raw<unknown>(null);
	private timer: ReturnType<typeof setTimeout> | null = null;
	private readonly ttlMs: number;
	/**
	 * How the app names the space an offer belongs to. The app tells the owner, as it tells
	 * it the exit guard; unset it answers nothing and the check does not apply.
	 */
	space: () => DataSpaceId | null = () => null;

	constructor(ttlMs = UNDO_TTL_MS) {
		this.ttlMs = ttlMs;
	}

	offer(offer: UndoOffer): void {
		// A step in flight owns the offer until it settles; nothing replaces it meanwhile.
		if (this.busy) return;
		this.clearTimer();
		this.failure = null;
		this.inverted = false;
		this.pending = offer;
		this.timer = setTimeout(() => this.dismiss(), this.ttlMs);
	}

	/**
	 * Takes the action back, then shows it. An offer made in another space is not acted on:
	 * the records it names are not the ones open now.
	 */
	async undo(): Promise<void> {
		const offer = this.pending;
		if (!offer || this.busy) return;
		const current = this.space();
		if (current !== null && offer.space !== current) {
			this.failure = 'space';
			this.pending = null;
			this.clearTimer();
			return;
		}
		this.busy = true;
		this.clearTimer();
		try {
			// The inverse is written once. A second press after it committed only reads again.
			if (!this.inverted) {
				await offer.invert();
				this.inverted = true;
				this.failure = null;
			}
			await offer.read();
			this.pending = null;
			this.inverted = false;
			this.failure = null;
		} catch (cause) {
			this.failure = cause ?? new Error();
		} finally {
			this.busy = false;
		}
	}

	dismiss(): void {
		if (this.busy) return;
		this.clearTimer();
		this.pending = null;
		this.inverted = false;
		this.failure = null;
	}

	private clearTimer(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}
}
