/* eslint-disable svelte/prefer-svelte-reactivity -- these sets are immutable values replaced whole (ReadonlySet); reactivity is the reassignment, nothing is changed in place */
import type { LegendKey } from '$lib/model/Legend/types';

/**
 * Legend kinds (hidden with Shift+click, or one kept alone with «соло», research
 * п. 17), hidden Scopes and «Только эти Scope» count together and reset
 * with one button (DESIGN.md §7). The record search sits beside them: it dims
 * what it misses instead of hiding anything, so it is not counted as a filter,
 * but «Сбросить всё» clears it too. Never persisted (research п. 9, Q2-A).
 */
export class FiltersState {
	hiddenLegend = $state<ReadonlySet<LegendKey>>(new Set());
	/** «Соло»: the one legend kind left on the ribbon; wins over `hiddenLegend` while set. */
	soloLegend = $state<LegendKey | null>(null);
	hiddenScopes = $state<ReadonlySet<string>>(new Set());
	shownKindIds = $state<ReadonlySet<string>>(new Set());
	onlyScopes = $state<ReadonlySet<string> | null>(null);
	scopeQuery = $state('');
	/** «Поиск по записям…»: title and description of the records on the axis. */
	recordQuery = $state('');

	get activeCount(): number {
		return (
			this.hiddenLegend.size +
			(this.soloLegend ? 1 : 0) +
			this.hiddenScopes.size +
			this.shownKindIds.size +
			(this.onlyScopes ? 1 : 0) +
			(this.scopeQuery.trim() ? 1 : 0)
		);
	}

	/** Whether marks of this kind are on the ribbon: the solo kind alone while set, else all but the hidden. */
	isShown(key: LegendKey): boolean {
		return this.soloLegend ? this.soloLegend === key : !this.hiddenLegend.has(key);
	}

	/** Shift+click: hides or shows one kind; a solo in force ends, as the mock does. */
	toggleLegend(key: LegendKey): void {
		this.soloLegend = null;
		const next = new Set(this.hiddenLegend);
		if (!next.delete(key)) next.add(key);
		this.hiddenLegend = next;
	}

	/** Click: only this kind stays; the same kind again brings everything back. The hidden set waits underneath. */
	soloLegendKind(key: LegendKey): void {
		this.soloLegend = this.soloLegend === key ? null : key;
	}

	toggleKind(kindId: string): void {
		const next = new Set(this.shownKindIds);
		if (!next.delete(kindId)) next.add(kindId);
		this.shownKindIds = next;
	}

	hideScope(scopeId: string): void {
		if (!this.hiddenScopes.has(scopeId))
			this.hiddenScopes = new Set(this.hiddenScopes).add(scopeId);
	}

	showScope(scopeId: string): void {
		if (!this.hiddenScopes.has(scopeId)) return;
		const next = new Set(this.hiddenScopes);
		next.delete(scopeId);
		this.hiddenScopes = next;
	}

	setOnly(scopeIds: readonly string[] | null): void {
		this.onlyScopes = scopeIds && scopeIds.length > 0 ? new Set(scopeIds) : null;
	}

	showAllScopes(): void {
		this.hiddenScopes = new Set();
	}

	reset(): void {
		this.shownKindIds = new Set();
		this.scopeQuery = '';
		this.recordQuery = '';
		this.hiddenLegend = new Set();
		this.soloLegend = null;
		this.hiddenScopes = new Set();
		this.onlyScopes = null;
	}
}
