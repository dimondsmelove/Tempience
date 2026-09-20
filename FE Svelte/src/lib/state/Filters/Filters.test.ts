import { describe, expect, it } from 'vitest';
import { FiltersState } from './Filters.svelte';

describe('FiltersState', () => {
	it('the record search is not a filter: it does not count, and the global reset clears it (п. 9)', () => {
		const filters = new FiltersState();
		filters.recordQuery = 'белград';
		expect(filters.activeCount).toBe(0);
		filters.reset();
		expect(filters.recordQuery).toBe('');
	});

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
	it('«соло» is one filter: click sets it, the same click clears it, Shift+click ends it; reset clears all', () => {
		const filters = new FiltersState();
		filters.soloLegendKind('intent');
		expect(filters.soloLegend).toBe('intent');
		expect(filters.activeCount).toBe(1);
		expect(filters.isShown('intent')).toBe(true);
		expect(filters.isShown('fact')).toBe(false);
		filters.soloLegendKind('rollup');
		expect(filters.soloLegend).toBe('rollup');
		filters.soloLegendKind('rollup');
		expect(filters.soloLegend).toBeNull();
		expect(filters.isShown('fact')).toBe(true);
		// A hidden kind waits under the solo and returns with it.
		filters.toggleLegend('rollup');
		filters.soloLegendKind('intent');
		expect(filters.activeCount).toBe(2);
		expect(filters.isShown('rollup')).toBe(false);
		expect(filters.isShown('fact')).toBe(false);
		filters.soloLegendKind('intent');
		expect(filters.isShown('fact')).toBe(true);
		expect(filters.isShown('rollup')).toBe(false);
		// Shift+click while a solo is on: the solo ends and the kind toggles, as the mock does.
		filters.soloLegendKind('intent');
		filters.toggleLegend('fact');
		expect(filters.soloLegend).toBeNull();
		expect(filters.hiddenLegend).toEqual(new Set(['rollup', 'fact']));
		filters.soloLegendKind('multi');
		filters.reset();
		expect(filters.soloLegend).toBeNull();
		expect(filters.hiddenLegend.size).toBe(0);
		expect(filters.activeCount).toBe(0);
	});

	it('restores hidden scopes without clearing search, and includes search in the global reset', () => {
		const filters = new FiltersState();
		filters.scopeQuery = '   ';
		expect(filters.activeCount).toBe(0);
		filters.scopeQuery = 'работа';
		filters.hideScope('a');
		filters.toggleLegend('fact');
		expect(filters.activeCount).toBe(3);
		filters.showAllScopes();
		expect(filters.activeCount).toBe(2);
		expect(filters.scopeQuery).toBe('работа');
		filters.reset();
		expect(filters.scopeQuery).toBe('');
		expect(filters.activeCount).toBe(0);
	});
});
