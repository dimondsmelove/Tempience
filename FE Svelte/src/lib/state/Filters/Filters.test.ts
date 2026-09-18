import { describe, expect, it } from 'vitest';
import { FiltersState } from './Filters.svelte';

describe('FiltersState', () => {
	it('counts legend items, hidden Scopes and «only these» together and resets at once', () => {
		const filters = new FiltersState();
		expect(filters.activeCount).toBe(0);
		filters.toggleLegend('intent');
		filters.toggleLegend('rollup');
		filters.toggleKind('weight');
		filters.toggleKind('weight');
		filters.toggleLegend('intent');
		filters.hideScope('a');
		filters.hideScope('a');
		filters.setOnly(['b', 'c']);
		expect(filters.isShown('rollup')).toBe(false);
		expect(filters.activeCount).toBe(3);
		filters.showScope('a');
		expect(filters.activeCount).toBe(2);
		filters.setOnly([]);
		expect(filters.onlyScopes).toBeNull();
		filters.toggleKind('weight');
		expect(filters.shownKindIds.has('weight')).toBe(true);
		expect(filters.activeCount).toBe(2);
		filters.reset();
		expect(filters.shownKindIds.size).toBe(0);
		expect(filters.activeCount).toBe(0);
	});
	it('restores hidden scopes without clearing search, and includes search in the global reset', () => {
		const filters = new FiltersState();
		filters.scopeQuery = '   ';
		expect(filters.activeCount).toBe(0);
		filters.scopeQuery = 'работа';
		filters.hideScope('a');
		filters.toggleLegend('moment');
		expect(filters.activeCount).toBe(3);
		filters.showAllScopes();
		expect(filters.activeCount).toBe(2);
		expect(filters.scopeQuery).toBe('работа');
		filters.reset();
		expect(filters.scopeQuery).toBe('');
		expect(filters.activeCount).toBe(0);
	});
});
