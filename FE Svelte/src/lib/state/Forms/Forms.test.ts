import { expect, it } from 'vitest';
import { FormsState } from './Forms.svelte';

it('keeps the history of the Kind while inspecting records and starts another Kind unfiltered', () => {
	const forms = new FormsState();
	forms.showCatalog('weight');
	const revision = forms.revision;
	forms.showData('weight', 'v1');
	const history = forms.history;
	history?.setFilters({ scope: { id: 'health', mode: 'subtree' } });
	forms.open = false;
	forms.showCatalog('weight');
	expect(forms.revision).toBeGreaterThan(revision);
	expect(forms.data).toEqual({ kindId: 'weight', versionId: 'v1' });
	// The record «Записать» starts with the history's Scope.
	expect(forms.scopeId).toBe('health');
	forms.showHistory('weight', 'v2');
	expect(forms.history).toBe(history);
	expect(forms.scopeId).toBe('health');
	// Back on the timeline and into the same Kind again: the same history, as left.
	forms.showTimeline();
	expect(forms.data).toBeNull();
	forms.showHistory('weight');
	expect(forms.history).toBe(history);
	expect(forms.data).toEqual({ kindId: 'weight' });
	forms.showHistory('workout', 'v1');
	expect(forms.history).not.toBe(history);
	expect(forms.scopeId).toBe('');
});

it('opens the catalog on a new Kind with the Scope it was asked from, and as itself afterwards', () => {
	const forms = new FormsState();
	forms.showCatalog('weight');
	const revision = forms.revision;
	forms.open = false;
	forms.createKind(['health']);
	expect([forms.open, forms.kindId, forms.newKindScopeIds]).toEqual([true, undefined, ['health']]);
	expect(forms.revision).toBeGreaterThan(revision);
	forms.open = false;
	forms.showCatalog();
	expect([forms.open, forms.newKindScopeIds]).toEqual([true, null]);
});
