/* eslint-disable svelte/prefer-svelte-reactivity -- these sets are immutable values replaced whole (ReadonlySet); reactivity is the reassignment, nothing is changed in place */
import type { LegendKey } from '$lib/model/Projection/types';

/**
 * Legend items, hidden Scopes and «Только эти Scope» count together and reset
 * with one button (DESIGN.md §7).
 */
export class FiltersState {
	hiddenLegend = $state<ReadonlySet<LegendKey>>(new Set());
	hiddenScopes = $state<ReadonlySet<string>>(new Set());
	shownKindIds = $state<ReadonlySet<string>>(new Set());
	onlyScopes = $state<ReadonlySet<string> | null>(null);
	scopeQuery = $state('');

	get activeCount(): number {
		return (
			this.hiddenLegend.size +
			this.hiddenScopes.size +
			this.shownKindIds.size +
			(this.onlyScopes ? 1 : 0) +
			(this.scopeQuery.trim() ? 1 : 0)
		);
	}

	isShown(key: LegendKey): boolean {
		return !this.hiddenLegend.has(key);
	}

	toggleLegend(key: LegendKey): void {
		const next = new Set(this.hiddenLegend);
		if (!next.delete(key)) next.add(key);
		this.hiddenLegend = next;
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
		this.hiddenLegend = new Set();
		this.hiddenScopes = new Set();
		this.onlyScopes = null;
	}
}
