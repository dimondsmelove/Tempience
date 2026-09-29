import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { WATSON_STORY, type DemoStoryEntry } from '$lib/scenarios/demo/registry';
import DemoStories from './DemoStories.svelte';
import { DEMO_STORIES_TEST_ID, demoStoryOpenTestId, demoStoryTestId } from './constants';

const textOf = (body: string): string => body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

/** A second story, so the catalog is read as a catalog and not as one card. */
const ANYA: DemoStoryEntry = {
	...WATSON_STORY,
	id: 'anya',
	dataSpaceId: 'demo-anya-v1',
	titleKey: 'demo.story.anya.title',
	bodyKey: 'demo.story.anya.body',
	openKey: 'demo.story.anya.open',
	locales: ['ru']
};

/** The host's own choice, as the tour passes «Начать со своих записей». */
const ownChoice = createRawSnippet(() => ({ render: () => '<button>своя карточка</button>' }));

describe('the catalog of demo stories', () => {
	it('shows a card per story — its title and body, the whole card the button — with the ids of that story', () => {
		const { body } = render(DemoStories, {
			props: { variant: 'cards', entries: [WATSON_STORY, ANYA], onopen: vi.fn() }
		});
		const text = textOf(body);
		expect(text).toContain('Записная книжка доктора Ватсона');
		expect(text).toContain('Рейхенбах и возвращение');
		expect(text).toContain('Блокнот Ани');
		expect(text).not.toContain('Открыть');
		for (const id of ['watson', 'anya']) {
			expect(body).toContain(`data-testid="${demoStoryTestId(id)}"`);
			expect(body).toContain(`data-testid="${demoStoryOpenTestId(id)}"`);
		}
	});

	it('is a compact list of «Открыть …» buttons in the menu, without the bodies', () => {
		const { body } = render(DemoStories, {
			props: { variant: 'list', entries: [WATSON_STORY, ANYA], onopen: vi.fn() }
		});
		const text = textOf(body);
		expect(text).toContain('Открыть записную книжку Ватсона');
		expect(text).toContain('Открыть блокнот Ани');
		expect(text).not.toContain('Рейхенбах и возвращение');
		expect(body).toContain(`data-testid="${demoStoryOpenTestId('watson')}"`);
		expect(body).not.toContain(`data-testid="${demoStoryTestId('watson')}"`);
	});

	it('offers by default every story written in the interface language', () => {
		const { body } = render(DemoStories, { props: { variant: 'cards', onopen: vi.fn() } });
		// The interface speaks Russian here, and Watson's notebook is written in it.
		expect(textOf(body)).toContain('Записная книжка доктора Ватсона');
		expect(body).toContain(`data-testid="${demoStoryTestId('watson')}"`);
	});

	it('never offers the story already open, and shows nothing when none is left', () => {
		const open = render(DemoStories, {
			props: {
				variant: 'cards',
				entries: [WATSON_STORY, ANYA],
				onopen: vi.fn(),
				activeId: 'watson'
			}
		});
		expect(textOf(open.body)).not.toContain('Записная книжка доктора Ватсона');
		expect(textOf(open.body)).toContain('Блокнот Ани');

		const none = render(DemoStories, {
			props: { variant: 'list', entries: [WATSON_STORY], onopen: vi.fn(), activeId: 'watson' }
		});
		expect(none.body).not.toContain(DEMO_STORIES_TEST_ID);
		expect(textOf(none.body).trim()).toBe('');
	});

	it("lays the cards out by how many there are, and keeps the host's own choice in the grid", () => {
		const one = render(DemoStories, {
			props: { variant: 'cards', entries: [WATSON_STORY], onopen: vi.fn() }
		});
		expect(one.body).toContain('grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]');
		expect(one.body).not.toContain('sm:grid-cols-2');

		const none = render(DemoStories, {
			props: { variant: 'cards', entries: [], onopen: vi.fn(), after: ownChoice }
		});
		expect(none.body).toContain(DEMO_STORIES_TEST_ID);
		expect(textOf(none.body)).toContain('своя карточка');
	});

	it('disables every offer while the host is busy opening one', () => {
		const { body } = render(DemoStories, {
			props: { variant: 'list', entries: [WATSON_STORY], onopen: vi.fn(), busy: true }
		});
		expect(body).toContain('disabled');
		expect(body).toContain(`data-testid="${demoStoryOpenTestId('watson')}"`);
	});
});
