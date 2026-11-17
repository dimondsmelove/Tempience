import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import ResponsiveMenu from './ResponsiveMenu.svelte';

it('renders one labelled menu and its shared commands on the server', () => {
	const trigger = createRawSnippet(() => ({ render: () => '<span>Open</span>' }));
	const children = createRawSnippet(() => ({ render: () => '<span>Choice</span>' }));
	const body = render(ResponsiveMenu, {
		props: { id: 'choices', label: 'Choices', trigger, children }
	}).body;
	expect(body).toContain('aria-label="Choices"');
	expect(body.match(/Choice<\/span>/g)).toHaveLength(1);
});
