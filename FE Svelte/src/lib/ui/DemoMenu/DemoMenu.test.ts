import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_MENU_CONFIRM_DELETE_TEST_ID, DEMO_MENU_DELETE_TEST_ID } from './constants';

const space = vi.hoisted(() => ({ id: 'canonical' }));
vi.mock('$lib/state/triplit/client', () => ({ activeDataSpace: space, triplit: {} }));

const load = async () => (await import('./DemoMenu.svelte')).default;
const textOf = (body: string): string => body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('demo and tour menu', () => {
	beforeEach(() => {
		space.id = 'canonical';
	});

	it('offers the tour and «Открыть записную книжку Ватсона» outside the demo', async () => {
		const { body } = render(await load());
		const text = textOf(body);
		expect(text).toContain('Знакомство');
		expect(text).toContain('Как устроено Tempience');
		expect(text).toContain('Открыть записную книжку Ватсона');
		expect(text).not.toContain('Удалить демо');
		expect(text).not.toContain('Это записная книжка доктора Ватсона');
	});

	it('offers the tour, the notice and «Удалить демо» inside the demo, with its own ids', async () => {
		space.id = 'demo-v1';
		const { body } = render(await load());
		const text = textOf(body);
		expect(text).toContain('Как устроено Tempience');
		expect(text).toContain('Это записная книжка доктора Ватсона');
		expect(text).toContain('Удалить демо');
		expect(text).not.toContain('Открыть записную книжку Ватсона');
		expect(body).toContain(`data-testid="${DEMO_MENU_DELETE_TEST_ID}"`);
		// The confirm step is not shown until asked for; its id never collides with the space menu's.
		expect(body).not.toContain(`data-testid="${DEMO_MENU_CONFIRM_DELETE_TEST_ID}"`);
		expect(body).not.toContain('data-testid="demo-delete"');
	});
});
