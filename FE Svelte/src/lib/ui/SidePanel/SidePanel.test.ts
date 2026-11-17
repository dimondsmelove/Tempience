import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import SidePanel from './SidePanel.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Contents</p>' }));
const props = {
	title: 'Task',
	canBack: false,
	canForward: true,
	position: { n: 1, m: 2 },
	onback: vi.fn(),
	onforward: vi.fn(),
	onclose: vi.fn(),
	children
};

describe('SidePanel', () => {
	it('renders its contents and history controls, and makes the closed panel inert', () => {
		const { body } = render(SidePanel, { props: { ...props, open: false } });
		expect(body).toContain('role="dialog"');
		expect(body).toContain('aria-label="Task"');
		expect(body).toContain('inert');
		expect(body).toContain('Contents');
		expect(body).toContain('1 / 2');
		expect(body).toMatch(/<button[^>]*aria-label="Назад по истории"[^>]*disabled/);
	});
});
