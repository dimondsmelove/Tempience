import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import MobileSheet from './MobileSheet.svelte';

it('renders its labelled modal sheet and content on the server', () => {
	const children = createRawSnippet(() => ({ render: () => '<p>Sheet content</p>' }));
	const body = render(MobileSheet, {
		props: { label: 'Choices', onclose: () => {}, children }
	}).body;
	expect(body).toContain('aria-label="Choices"');
	expect(body).toContain('aria-modal="true"');
	expect(body).toContain('Sheet content');
});
