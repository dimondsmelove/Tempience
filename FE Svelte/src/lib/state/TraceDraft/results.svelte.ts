import type {
	IntentionAssessment,
	IntentionOutcome
} from '$lib/state/triplit/IntentionAssessments/types';
import type { LinkHead } from '$lib/state/triplit/Intersections/heads';
import type { Trace, TraceKind, TraceKindV } from '$lib/state/triplit/types';
import { resultRows, type ResultRow } from './results';
import { EMPTY_INPUT, addTarget, removeTarget, setTargetFeature } from './targets';
import type { ResultTarget } from './types';

/**
 * The «Результат для» part of the one open form: the chosen targets with the user's own
 * statements, over the records the picker offers. The saved links are the baseline; a
 * relation switch returns to it and never restores a selection made before.
 */
export class ResultsState {
	targets = $state.raw<readonly ResultTarget[]>([]);
	baseline = $state.raw<readonly ResultTarget[]>([]);
	traces = $state.raw<readonly Trace[]>([]);
	intersections = $state.raw<readonly LinkHead[]>([]);
	assessments = $state.raw<readonly IntentionAssessment[]>([]);
	/** The Kind catalogs a typed record is named by, the same ones the form offers. */
	kinds = $state.raw<readonly TraceKind[]>([]);
	versions = $state.raw<readonly TraceKindV[]>([]);
	/** Every record with its label, Scopes and, for an intention, its derived current state. */
	readonly rows = $derived(
		resultRows(this.traces, this.intersections, this.assessments, {
			kinds: this.kinds,
			versions: this.versions
		})
	);

	rowOf(id: string): ResultRow | null {
		return this.rows.get(id) ?? null;
	}

	/** The saved links this input started with, and its first selection. */
	start(baseline: readonly ResultTarget[], initial: readonly ResultTarget[] = baseline): void {
		this.baseline = baseline;
		this.targets = initial;
	}

	/** A selection never filters the picker; adding a record already chosen changes nothing. */
	add(otherId: string): void {
		this.targets = addTarget(this.targets, otherId, this.baseline);
	}

	/** Explicit removal; a saved link removed here is withdrawn by the save. */
	remove(otherId: string): void {
		this.targets = removeTarget(this.targets, otherId);
	}

	/**
	 * Takes back the statement started for one target, leaving the target, its saved link and
	 * every other input of the form as they are: the way out of a statement that cannot be made.
	 */
	clearInput(otherId: string): void {
		this.targets = this.targets.map((target) =>
			target.otherId === otherId ? { ...target, input: EMPTY_INPUT } : target
		);
	}

	has(otherId: string): boolean {
		return this.targets.some((target) => target.otherId === otherId);
	}

	/** `undefined` leaves the outcome untouched, null removes the own value. */
	setOutcome(otherId: string, value: IntentionOutcome | null | undefined): void {
		this.targets = setTargetFeature(this.targets, otherId, 'outcome', value);
	}

	/** `undefined` leaves openness untouched: an unchecked box is no statement. */
	setOpen(otherId: string, value: boolean | null | undefined): void {
		this.targets = setTargetFeature(this.targets, otherId, 'open', value);
	}

	/** Back to the saved links with untouched input; nothing chosen before comes back. */
	reset(): void {
		this.targets = this.baseline.map((target) => ({ ...target, input: EMPTY_INPUT }));
	}
}
