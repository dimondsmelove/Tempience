import { SvelteSet } from 'svelte/reactivity';
import type { TraceDraftState } from './TraceDraft.svelte';

/**
 * Work of the app that an exit must wait for although it is not an open form, and input it
 * keeps only in memory. Ordinary in-app transitions leave such input where it is — nothing
 * is lost by them — so only a transition that ends this session's memory asks about it.
 */
export type PendingWork = {
	readonly pending: Promise<void> | null;
	/** Whether anything is held that a reload of the app would lose. */
	readonly retained?: boolean;
	/** Drops exactly what such a reload would lose. */
	discardRetained?: () => void;
};

/**
 * One gate for every in-app exit that would end an open form: closing the Context, a
 * history or selection step, the catalog, a route change, a DataSpace switch, opening a
 * restored database or applying an update. With no changes the exit proceeds at once; with
 * changes the accepted question is asked once and the requested transition completes only
 * after «Отбросить изменения». A save in flight is neither abandoned nor overtaken: the exit
 * waits for its write and opening to settle, then the ordinary rules apply to what is left.
 * Nested subviews of the form never pass through here.
 */
/** Input of a form that is not a Trace draft — a Scope's editor — under the same exit rule. */
export type WatchedInput = { readonly dirty: () => boolean; readonly discard: () => void };

export class DraftExitGuard {
	/** The question currently shown; resolved by the dialog. */
	request = $state.raw<{ resolve: (discard: boolean) => void } | null>(null);
	private readonly drafts = new SvelteSet<TraceDraftState>();
	private readonly watched = new SvelteSet<PendingWork>();
	private readonly inputs = new SvelteSet<WatchedInput>();

	register(draft: TraceDraftState): () => void {
		this.drafts.add(draft);
		return () => this.drafts.delete(draft);
	}

	/**
	 * Work that is not an open form but must still settle before an exit: a Context command
	 * in flight, with the input its views keep in memory between them.
	 */
	watch(work: PendingWork): () => void {
		this.watched.add(work);
		return () => this.watched.delete(work);
	}

	/** Other forms with unsaved input: asked about and discarded like a draft. */
	watchInput(input: WatchedInput): () => void {
		this.inputs.add(input);
		return () => this.inputs.delete(input);
	}

	get dirty(): boolean {
		for (const draft of this.drafts) if (draft.dirty) return true;
		for (const input of this.inputs) if (input.dirty()) return true;
		return false;
	}

	/** Input that survives every in-app transition but not a reload of the app. */
	get retained(): boolean {
		for (const work of this.watched) if (work.retained) return true;
		return false;
	}

	/** A write or the opening of its result is still running. */
	get busy(): boolean {
		for (const draft of this.drafts) if (draft.pending) return true;
		for (const work of this.watched) if (work.pending) return true;
		return false;
	}

	/** Every pending save has settled: committed and opened, failed, or opening refused. */
	async settle(): Promise<void> {
		while (this.busy) {
			await Promise.all([
				...[...this.drafts].map((draft) => draft.pending ?? Promise.resolve()),
				...[...this.watched].map((work) => work.pending ?? Promise.resolve())
			]);
		}
	}

	/** Resolves `true` when the exit may proceed; the open forms are discarded on the way. */
	confirm(): Promise<boolean> {
		return this.ask(false);
	}

	/**
	 * The same question before a transition that reloads the app — switching the DataSpace,
	 * opening a restored database, applying an update. Such a transition also ends what the
	 * views kept in memory, so that input is asked about here and nowhere else.
	 */
	confirmReloading(): Promise<boolean> {
		return this.ask(true);
	}

	private async ask(reloading: boolean): Promise<boolean> {
		// A command still running may take the very input this would ask about.
		await this.settle();
		if (!this.dirty && !(reloading && this.retained)) return true;
		if (this.request) return false;
		const discard = await new Promise<boolean>((resolve) => {
			this.request = { resolve };
		});
		this.request = null;
		if (!discard) return false;
		this.discardAll();
		if (reloading) for (const work of this.watched) work.discardRetained?.();
		return true;
	}

	/** Runs the transition now, or after the pending save and the question when needed. */
	exit(then: () => void): void {
		this.run(then, false);
	}

	/** The same, for a transition after which the app reloads (see `confirmReloading`). */
	exitReloading(then: () => void): void {
		this.run(then, true);
	}

	private run(then: () => void, reloading: boolean): void {
		if (!this.dirty && !this.busy && !(reloading && this.retained)) {
			then();
			return;
		}
		void this.ask(reloading).then((proceed) => {
			if (proceed) then();
		});
	}

	discardAll(): void {
		for (const draft of this.drafts) draft.discard();
		this.drafts.clear();
		for (const input of this.inputs) input.discard();
		this.inputs.clear();
	}

	keep(): void {
		this.request?.resolve(false);
	}

	discard(): void {
		this.request?.resolve(true);
	}
}

export const draftGuard = new DraftExitGuard();
