import type { PeriodRef } from '$lib/model/Axis/types';
import type { SelectionPosition, SelectionTarget, SelectSource } from './types';

export const selectionKey = (target: SelectionTarget): string =>
	target.kind === 'trace'
		? `trace:${target.traceId}`
		: target.kind === 'scope'
			? `scope:${target.scopeId}`
			: target.kind === 'intersection'
				? `intersection:${target.intersectionId}`
				: target.kind === 'period-record'
					? `period-record:${target.periodId}`
					: target.kind === 'row'
						? `row:${target.rowId}`
						: `period:${target.period.unit}:${target.period.start}`;

/**
 * The selected record or period with back/forward history (DESIGN.md §8).
 * Every navigation records where it came from, so the window can decide
 * whether to move (DP7: only choices made off the canvas move it).
 * «Покой» (C9a-1) steps aside from the selection without losing the history:
 * nothing is current, «→» returns to the last viewed entry.
 */
export class SelectionState {
	entries = $state.raw<readonly SelectionTarget[]>([]);
	index = $state(-1);
	source = $state<SelectSource | null>(null);
	/** Nothing is selected, but `entries` and `index` still remember where the user was. */
	resting = $state(false);
	/** Bumps on every navigation, even to the same target, so effects can follow it. */
	revision = $state(0);

	get current(): SelectionTarget | null {
		return this.resting ? null : (this.entries[this.index] ?? null);
	}

	get traceId(): string | null {
		const current = this.current;
		return current?.kind === 'trace' ? current.traceId : null;
	}

	get scopeId(): string | null {
		const current = this.current;
		return current?.kind === 'scope' ? current.scopeId : null;
	}

	get period(): PeriodRef | null {
		const current = this.current;
		return current?.kind === 'period' ? current.period : null;
	}

	/** The merged row chosen in the rail (C5), by its row id. */
	get rowId(): string | null {
		const current = this.current;
		return current?.kind === 'row' ? current.rowId : null;
	}

	get entityId(): string | null {
		const current = this.current;
		return current?.kind === 'intersection'
			? current.intersectionId
			: current?.kind === 'period-record'
				? current.periodId
				: null;
	}

	get canBack(): boolean {
		return !this.resting && this.index > 0;
	}

	get canForward(): boolean {
		return this.resting ? this.entries.length > 0 : this.index < this.entries.length - 1;
	}

	/** `n / m` of the header; at rest there is no `n` and the header draws «— / m». */
	get position(): SelectionPosition {
		return { n: this.resting ? null : this.index + 1, m: this.entries.length };
	}

	select(target: SelectionTarget, source: SelectSource): void {
		this.resting = false;
		const current = this.current;
		if (!current || selectionKey(current) !== selectionKey(target)) {
			this.entries = [...this.entries.slice(0, this.index + 1), target];
			this.index = this.entries.length - 1;
		}
		this.source = source;
		this.revision += 1;
	}

	back(): void {
		if (!this.canBack) return;
		this.index -= 1;
		this.source = 'history';
		this.revision += 1;
	}

	/** From rest this returns to the last viewed entry; the index does not move. */
	forward(): void {
		if (!this.canForward) return;
		if (this.resting) this.resting = false;
		else this.index += 1;
		this.source = 'history';
		this.revision += 1;
	}

	/** Покой: the current selection steps aside, the history stays for «→». */
	rest(): void {
		if (!this.current) return;
		this.resting = true;
		this.source = null;
		this.revision += 1;
	}

	/** A new DataSpace: the history is gone, and so is the rest. */
	clear(): void {
		this.entries = [];
		this.index = -1;
		this.source = null;
		this.resting = false;
		this.revision += 1;
	}
}
