import { render } from 'svelte/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoUpdate } from '$lib/state/DemoUpdate/DemoUpdate.svelte';
import { locale } from '$lib/state/Locale/Locale.svelte';
import {
	DEMO_UPDATE_CONFIRM_TEST_ID,
	DEMO_UPDATE_REBUILD_TEST_ID,
	DEMO_UPDATE_TEST_ID
} from './constants';

vi.mock('$lib/state/triplit/client', () => ({ activeDataSpace: { id: 'demo-v1' }, triplit: {} }));

const load = async () => (await import('./DemoUpdate.svelte')).default;
const textOf = (body: string): string => body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

describe('the demo update control', () => {
	beforeEach(() => locale.set('ru'));
	afterEach(() => {
		demoUpdate.available = false;
	});

	it('shows nothing while the notebook is the one this build ships', async () => {
		const { body } = render(await load());
		expect(body).not.toContain(DEMO_UPDATE_TEST_ID);
	});

	it('says the demo was updated and offers the rebuild, the warning only when asked', async () => {
		demoUpdate.available = true;
		const { body } = render(await load());
		const text = textOf(body);
		expect(body).toContain(`data-testid="${DEMO_UPDATE_TEST_ID}"`);
		expect(text).toContain('Демо обновилось');
		expect(body).toContain(`data-testid="${DEMO_UPDATE_REBUILD_TEST_ID}"`);
		expect(body).not.toContain(`data-testid="${DEMO_UPDATE_CONFIRM_TEST_ID}"`);
		expect(text).not.toContain('Записи, добавленные в демо, будут удалены.');
	});

	it('speaks the interface language of the moment', async () => {
		demoUpdate.available = true;
		locale.set('en');
		const text = textOf(render(await load()).body);
		expect(text).toContain('The demo was updated');
		expect(text).toContain('Update');
	});
});
