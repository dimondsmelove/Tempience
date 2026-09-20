import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { InboundFeed } from '$lib/state/triplit/inbound-sync';
import { INBOUND_REFRESH_DEBOUNCE_MS } from './constants';
import type { WorkbenchState } from './Workbench.svelte';

/** The workbench the feed refreshes, its loader, and what a read from outside must wait for. */
type Followed = Readonly<{
	workbench: Pick<WorkbenchState, 'status' | 'timelineCovered' | 'markStale' | 'refresh'>;
	loader: () => Promise<ExplorerSnapshot>;
	/** Input is under way: a form is open or an editor holds changes. */
	deferred: () => boolean;
}>;

/**
 * Changes from other devices, as the Time surface takes them (owner decision 2026-09-20).
 * Every answer of the server after the first read is a change: with no input under way the
 * snapshot is read again in place, debounced, the selection and the window kept; with a
 * form open the input is left alone and the sync indicator offers «Обновить» instead, which
 * reads on click — or the read follows by itself once the input ends. Behind a Kind's table
 * the timeline is marked stale, as after this device's own commits, and read when shown again.
 */
export class InboundState {
	/** When the server last answered for the snapshot's collections, ISO; null before the first time. */
	lastReadAt = $state<string | null>(null);
	/** A change landed while input was under way: the notice with «Обновить» is up until the read. */
	pending = $state(false);
	private timer: ReturnType<typeof setTimeout> | undefined;
	private followed: Followed | null = null;

	/** Follows the feed for the life of the workbench; what is returned ends it. */
	follow(feed: InboundFeed, followed: Followed): () => void {
		this.followed = followed;
		this.lastReadAt = feed.lastReadAt;
		this.pending = false;
		const stop = feed.onDelivery((delivery) => {
			this.lastReadAt = delivery.at;
			if (!delivery.initial) this.schedule();
		});
		return () => {
			stop();
			clearTimeout(this.timer);
			this.followed = null;
		};
	}

	/** A read is owed: after the quiet spell, unless input is under way by then. */
	schedule(): void {
		this.later(() => this.read(false));
	}

	/** «Обновить»: the read now, the open input left to itself. */
	refresh(): void {
		clearTimeout(this.timer);
		this.read(true);
	}

	private later(run: () => void): void {
		clearTimeout(this.timer);
		this.timer = setTimeout(run, INBOUND_REFRESH_DEBOUNCE_MS);
	}

	private read(force: boolean): void {
		const followed = this.followed;
		if (!followed) return;
		const { workbench } = followed;
		if (workbench.timelineCovered) {
			this.pending = false;
			workbench.markStale();
			return;
		}
		if (!force && followed.deferred()) {
			this.pending = true;
			return;
		}
		// A read in flight may have passed the changed collection already: read after it.
		if (workbench.status === 'loading') {
			this.later(() => this.read(force));
			return;
		}
		this.pending = false;
		void workbench.refresh(followed.loader);
	}
}

/** The one inbound state of the app: the workbench follows through it, the sync indicator reads it. */
export const inbound = new InboundState();
