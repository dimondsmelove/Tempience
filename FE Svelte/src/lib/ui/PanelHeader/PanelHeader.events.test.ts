import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import PanelHeader from './PanelHeader.svelte';

const captured = vi.hoisted(() => ({ buttons: [] as Array<{ onclick: () => void }> }));
vi.mock('$lib/ui/Button/Button.svelte', () => ({
	default: (_payload: unknown, props: { onclick: () => void }) => captured.buttons.push(props)
}));

it('passes history and close handlers to their buttons', () => {
	const onback = vi.fn();
	const onforward = vi.fn();
	const onclose = vi.fn();
	captured.buttons.length = 0;
	const { body } = render(PanelHeader, {
		props: {
			title: 'Task',
			position: { n: 1, m: 2 },
			canBack: true,
			canForward: true,
			onback,
			onforward,
			onclose
		}
	});
	expect(body).toContain('Task');
	expect(captured.buttons).toHaveLength(3);
	captured.buttons.forEach((button) => button.onclick());
	expect(onback).toHaveBeenCalledOnce();
	expect(onforward).toHaveBeenCalledOnce();
	expect(onclose).toHaveBeenCalledOnce();
});
