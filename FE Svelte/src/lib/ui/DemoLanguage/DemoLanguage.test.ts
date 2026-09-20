import { render } from 'svelte/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { locale } from '$lib/state/Locale/Locale.svelte';
import { DEMO_SEED_MARKER_KEY } from '$lib/state/triplit/data-space';
import {
	DEMO_LANGUAGE_CONFIRM_TEST_ID,
	DEMO_LANGUAGE_REBUILD_TEST_ID,
	DEMO_LANGUAGE_TEST_ID
} from './constants';

const space = vi.hoisted(() => ({ id: 'demo-v1' }));
vi.mock('$lib/state/triplit/client', () => ({ activeDataSpace: space, triplit: {} }));

const store = new Map<string, string>();
const storage = {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => void store.set(key, value),
	removeItem: (key: string) => void store.delete(key)
};

const load = async () => (await import('./DemoLanguage.svelte')).default;
const textOf = (body: string): string => body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
/** An SSR body of hydration markers alone: no element, no text. */
const nothing = (body: string): boolean =>
	!body.includes(DEMO_LANGUAGE_TEST_ID) && textOf(body).trim() === '';

describe('the demo language control', () => {
	beforeEach(() => {
		space.id = 'demo-v1';
		locale.set('ru');
		vi.stubGlobal('localStorage', storage);
	});

	afterEach(() => {
		store.clear();
		vi.unstubAllGlobals();
	});

	it('names the language the notebook is written in and offers the rebuild in the interface language', async () => {
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:en');
		const { body } = render(await load());
		const text = textOf(body);
		expect(body).toContain(`data-testid="${DEMO_LANGUAGE_TEST_ID}"`);
		expect(text).toContain('Демо на английском');
		expect(text).toContain('Пересобрать на русском');
		expect(body).toContain(`data-testid="${DEMO_LANGUAGE_REBUILD_TEST_ID}"`);
		// The confirm step and its warning are not shown until asked for.
		expect(body).not.toContain(`data-testid="${DEMO_LANGUAGE_CONFIRM_TEST_ID}"`);
		expect(text).not.toContain('Записи, добавленные в демо, будут удалены.');
		expect(text).not.toContain('Отмена');
	});

	it('speaks the interface language of the moment', async () => {
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:ru');
		locale.set('en');
		const text = textOf(render(await load()).body);
		expect(text).toContain('Demo in Russian');
		expect(text).toContain('Rebuild in English');
	});

	it('renders nothing while the notebook is written in the interface language', async () => {
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:ru');
		expect(render(await load()).body).toSatisfy(nothing);
	});

	it.each([
		['no marker', null],
		['a marker of another manifest', 'demo-v1:en']
	])('renders nothing when the seed language is unknown (%s)', async (_case, marker) => {
		if (marker !== null) storage.setItem(DEMO_SEED_MARKER_KEY, marker);
		expect(render(await load()).body).toSatisfy(nothing);
	});

	it('renders nothing outside the demo, whatever the marker says', async () => {
		space.id = 'canonical';
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:en');
		expect(render(await load()).body).toSatisfy(nothing);
	});
});
