import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import KindScopes from './KindScopes.svelte';

// The picker reads the Scope tree from the workbench; a server render has no client behind it.
vi.mock('$lib/state/Workbench/instance.svelte', () => ({
	workbench: { view: { intersections: [] } }
}));

const scopes = [
	{ id: 'a', name: 'A', note: null, parentScopeId: null, startedAt: null, endedAt: null },
	{ id: 'b', name: 'B', note: null, parentScopeId: null, startedAt: null, endedAt: null }
].map((scope) => ({ ...scope, isDeleted: false, createdAt: '', updatedAt: '' }));

describe('KindScopes', () => {
	it('shows the Kind’s current memberships as chips and offers the rest in the picker', () => {
		const untouched = render(KindScopes, {
			props: { scopes, value: { scopeIds: ['b'], explicit: false }, onchange: () => {} }
		}).body;
		// The chosen Scope is a chip with its ×; the picker lists it as taken and offers A.
		expect(untouched).toContain('aria-label="Убрать Scope B"');
		expect(untouched).toMatch(/role="option"[^>]*aria-disabled="true"[^>]*>[\s\S]*?B/);
		expect(untouched).not.toContain('aria-label="Убрать Scope A"');
		const empty = render(KindScopes, {
			props: { scopes, value: { scopeIds: [], explicit: false }, onchange: () => {} }
		}).body;
		// Nothing chosen shows no chip and no «Без Scope» button: the picker alone.
		expect(empty).not.toContain('Убрать Scope');
		expect(empty).toContain('role="combobox"');
	});
});
