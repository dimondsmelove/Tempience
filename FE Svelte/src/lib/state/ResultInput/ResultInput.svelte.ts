import { SvelteMap } from 'svelte/reactivity';
import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
import type { DataSpaceId } from '$lib/state/triplit/data-space';
import type { IntentionAssessmentValues } from '$lib/state/triplit/IntentionAssessments/types';

/** The address correction being prepared for one evidence link of one space. */
export type RetargetStep = Readonly<{ space: DataSpaceId; evidenceId: string; query: string }>;

/** Input belongs to the space it was entered in, and to the record it was entered for. */
/** A separator no id contains, written as the escape it is so the source stays text. */
const SEPARATOR = '\u0000';

const key = (space: DataSpaceId, id: string): string => `${space}${SEPARATOR}${id}`;

/**
 * What the Context holds for a record's result before it is written: the direct assessment
 * being entered for an intention and the address correction being prepared for one link.
 * It lives outside the Context components because that view is destroyed and rebuilt by
 * ordinary use — a layout change, another part of the Context, another record — and input a
 * user typed must not be lost by that. Nothing here is written by itself: it is kept until
 * the user sends it or drops it, and the one exit guard waits for a write that is running.
 *
 * Every entry names the DataSpace it belongs to. Independent spaces legitimately hold the
 * same record and link ids — a backup restored beside its original does — so input entered
 * in one must never be shown, sent or cleared in another. The space is given by the caller at
 * the moment of the command, not read back afterwards, so an answer that arrives later still
 * belongs where it was entered.
 */
export class ResultInputState {
	private readonly entered = new SvelteMap<string, IntentionAssessmentValues>();
	private step = $state.raw<RetargetStep | null>(null);
	/** The action in flight; the exit guard waits for it and no second one starts. */
	pending = $state.raw<Promise<void> | null>(null);

	/** What is entered for this intention of this space; nothing is until the user enters it. */
	for(space: DataSpaceId, intentionId: string): IntentionAssessmentValues {
		return this.entered.get(key(space, intentionId)) ?? {};
	}

	/** One feature of the direct assessment: `undefined` states nothing at all about it. */
	set(
		space: DataSpaceId,
		intentionId: string,
		feature: 'outcome' | 'open',
		value: IntentionAssessmentValues['outcome'] | boolean | undefined
	): void {
		const next: IntentionAssessmentValues = { ...this.for(space, intentionId) };
		delete next[feature];
		if (value !== undefined) Object.assign(next, { [feature]: value });
		if (Object.keys(next).length === 0) this.entered.delete(key(space, intentionId));
		else this.entered.set(key(space, intentionId), next);
	}

	/** The user drops what was entered, or a write took it; only in the space it belongs to. */
	clear(space: DataSpaceId, intentionId: string): void {
		this.entered.delete(key(space, intentionId));
	}

	/** Whether anything the repository would accept has been entered here. */
	stated(space: DataSpaceId, intentionId: string): boolean {
		const values = this.for(space, intentionId);
		return values.outcome != null || values.open != null;
	}

	/** The correction step of one link, kept open across the views that show it. */
	retargetFor(space: DataSpaceId, evidenceId: string): RetargetStep | null {
		return this.step?.space === space && this.step.evidenceId === evidenceId ? this.step : null;
	}

	openRetarget(space: DataSpaceId, evidenceId: string): void {
		this.step = { space, evidenceId, query: '' };
	}

	search(space: DataSpaceId, query: string): void {
		if (this.step?.space === space) this.step = { ...this.step, query };
	}

	/** Closes the step of this space; a step of another space is not this caller's to end. */
	closeRetarget(space: DataSpaceId): void {
		if (this.step?.space === space) this.step = null;
	}

	/** A write of the Context is its pending work: an exit waits for it, as a form's save is. */
	hold<T>(run: Promise<T>): Promise<T> {
		const settled = run.finally(() => {
			if (this.pending === waited) this.pending = null;
		});
		const waited = settled.then(() => {});
		this.pending = waited;
		return settled;
	}

	get busy(): boolean {
		return this.pending !== null;
	}

	/**
	 * Whether anything is held that only this session has: unsent values, or a correction step
	 * the user has actually prepared. An opened but untouched step is not input and asks nothing.
	 *
	 * A feature supplied as «nothing» counts. Clearing the outcome of a statement that stands is
	 * a correction the user prepared and has not sent; it is not the same as having said nothing
	 * about it, which is what an absent feature is. What may be sent as a new direct statement
	 * is a different question, and `stated` answers that one.
	 */
	get retained(): boolean {
		for (const values of this.entered.values()) {
			if ('outcome' in values || 'open' in values) return true;
		}
		return (this.step?.query ?? '') !== '';
	}

	/** Drops exactly what a reload of the app would take, once the user has said so. */
	discardRetained(): void {
		this.entered.clear();
		this.step = null;
	}
}

/** The one holder of unsent result input of the app, as the Context is one. */
export const resultInput = new ResultInputState();
// A command of the Context in flight is waited for by the same gate that waits for a form's
// save, so no exit overtakes a write and no second one starts behind it.
draftGuard.watch(resultInput);
