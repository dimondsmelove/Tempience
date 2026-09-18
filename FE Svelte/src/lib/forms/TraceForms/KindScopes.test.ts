import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import KindScopes from './KindScopes.svelte';

const scopes = [
	{ id: 'a', name: 'A', note: null, parentScopeId: null, startedAt: null, endedAt: null },
	{ id: 'b', name: 'B', note: null, parentScopeId: null, startedAt: null, endedAt: null }
].map((scope) => ({ ...scope, isDeleted: false, createdAt: '', updatedAt: '' }));

describe('KindScopes', () => {
	it('shows the Kind’s current memberships as chips, offers the rest, and marks only an explicit «Без Scope» as pressed', () => {
		const untouched = render(KindScopes, {
			props: { scopes, value: { scopeIds: ['b'], explicit: false }, onchange: () => {} }
		}).body;
		// The chosen Scope is a chip; the picker offers only what is not chosen yet.
		expect(untouched).toContain('<option value="a">A</option>');
		expect(untouched).not.toContain('<option value="b">');
		expect(untouched).toContain('>B</span>');
		expect(untouched).toContain('aria-pressed="false"');
		const emptyUntouched = render(KindScopes, {
			props: { scopes, value: { scopeIds: [], explicit: false }, onchange: () => {} }
		}).body;
		// Nothing chosen is not yet a choice: the restore of a deleted Scope stays possible.
		expect(emptyUntouched).toContain('aria-pressed="false"');
		const explicitNone = render(KindScopes, {
			props: { scopes, value: { scopeIds: [], explicit: true }, onchange: () => {} }
		}).body;
		expect(explicitNone).toContain('aria-pressed="true"');
	});
});
