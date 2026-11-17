import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import PanelHeader from './PanelHeader.svelte';

const props = {
	title: 'Task',
	position: { n: 2, m: 3 },
	canBack: true,
	canForward: false,
	onback: vi.fn(),
	onforward: vi.fn(),
	onclose: vi.fn()
};

describe('PanelHeader', () => {
	it('renders the title, history position, actions and disabled navigation', () => {
		const actions = createRawSnippet(() => ({ render: () => '<span>Action</span>' }));
		const { body } = render(PanelHeader, { props: { ...props, actions } });
		expect(body).toContain('Task');
		expect(body).toContain('2 / 3');
		expect(body).toContain('Action');
		expect(body).toMatch(/<button[^>]*aria-label="Вперёд по истории"[^>]*disabled/);
		expect(body).not.toMatch(/<button[^>]*aria-label="Назад по истории"[^>]*disabled/);
	});

	it('renders a resting position and disables back', () => {
		const { body } = render(PanelHeader, {
			props: { ...props, position: { n: null, m: 3 }, canBack: false, canForward: true }
		});
		expect(body).toContain('— / 3');
		expect(body).toMatch(/<button[^>]*aria-label="Назад по истории"[^>]*disabled/);
		expect(body).not.toMatch(/<button[^>]*aria-label="Вперёд по истории"[^>]*disabled/);
	});
});
