import { expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import Popover from './Popover.svelte';
import { notifyToggle } from './toggle';
import { popoverPosition } from './position';
it('keeps a panel within the viewport and flips above a trigger near the bottom', () => {
	const viewport = { width: 400, height: 300 };
	expect(
		popoverPosition(
			{ left: 350, right: 390, top: 260, bottom: 290 },
			{ width: 200, height: 180 },
			viewport
		)
	).toEqual({ left: 192, top: 76 });
	expect(
		popoverPosition(
			{ left: 20, right: 80, top: 10, bottom: 40 },
			{ width: 200, height: 180 },
			viewport
		)
	).toEqual({ left: 20, top: 44 });
});

it('keeps the trigger enabled by default and accepts a disabled trigger', () => {
	const trigger = createRawSnippet(() => ({ render: () => '<span>open</span>' }));
	const children = createRawSnippet<[() => void]>(() => ({ render: () => '<span>content</span>' }));
	const props = { id: 'test-popover', label: 'Open', trigger, children };
	expect(render(Popover, { props }).body).not.toMatch(/<button[^>]* disabled(?:[ =>])/);
	expect(render(Popover, { props: { ...props, disabled: true } }).body).toMatch(
		/<button[^>]* disabled(?:[ =>])/
	);
});
it('reports opening and closing only when a callback is supplied', () => {
	const callback = vi.fn();
	notifyToggle({ newState: 'open' }, callback);
	notifyToggle({ newState: 'closed' }, callback);
	expect(callback.mock.calls).toEqual([[true], [false]]);
	expect(() => notifyToggle({ newState: 'open' })).not.toThrow();
});
