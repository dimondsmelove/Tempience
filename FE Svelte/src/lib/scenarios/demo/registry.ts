import type { Locale, MessageKey } from '$lib/state/Locale/types';
import type { DemoStory } from './types';

/**
 * One demo story as the app knows it: its own replica, its own texts, its own storage keys and
 * the few facts the seed needs about the notebook's zone and its first page. Everything that
 * differs between stories lives here, so a new story is one entry and no edit anywhere else.
 */
export type DemoStoryEntry = Readonly<{
	/** Stable story id; also the suffix of its message keys and its test ids. */
	id: string;
	/** The isolated replica the story is seeded into. */
	dataSpaceId: string;
	/** The Triplit storage name of that replica. */
	storageName: string;
	/** The space's name and description in the switcher. */
	labelKey: MessageKey;
	descriptionKey: MessageKey;
	/** The catalog card: its title, its body and the «Открыть …» button. */
	titleKey: MessageKey;
	bodyKey: MessageKey;
	openKey: MessageKey;
	/** The manifest id is `<manifestPrefix>:<locale>`: a seed written in one language is never re-seeded in another. */
	manifestPrefix: string;
	/** Record ids are deterministic per story id: this prefix plus the story id with dots as dashes. */
	recordPrefix: string;
	/** Every date of the notebook is this zone, whatever zone the browser is in. */
	timezone: string;
	/** Records without an hour are captured at this local wall-clock time of their day. */
	captureTime: string;
	/** The record the workbench opens on after a seed. */
	startId: string;
	/** When true the start record is dated by the install instant, not by the story file. */
	startAtInstall: boolean;
	/** The interface languages the story is written in; it is offered in no other. */
	locales: readonly Locale[];
	/** The manifest the replica was seeded with; cleared with the replica on dismiss. */
	seedMarkerKey: string;
	/** «Удалить демо» sets it; while set, the story's space is not a valid DataSpace id. */
	dismissedKey: string;
	/** The story module, imported only when its replica is actually seeded. */
	load: () => Promise<DemoStory>;
}>;

/** Dr. Watson's notebook: the first story, with the ids and keys of its first release. */
export const WATSON_STORY = {
	id: 'watson',
	dataSpaceId: 'demo-v1',
	storageName: 'tempience-triplit-demo-v1',
	labelKey: 'demo.space.label',
	descriptionKey: 'demo.space.description',
	titleKey: 'demo.story.watson.title',
	bodyKey: 'demo.story.watson.body',
	openKey: 'demo.story.watson.open',
	manifestPrefix: 'watson-v1',
	recordPrefix: 'demo-',
	timezone: 'Europe/London',
	captureTime: '12:00',
	startId: 'w.start',
	startAtInstall: false,
	locales: ['ru', 'en'],
	seedMarkerKey: 'tempience.demo.seed',
	dismissedKey: 'tempience.demo.dismissed',
	load: async (): Promise<DemoStory> => (await import('./story')).DEMO_STORY
} as const satisfies DemoStoryEntry;

/**
 * Anya's notebook: an ordinary person's three years after moving to Belgrade, 2023-05 → 2026-09,
 * written in Russian and English; its first page is dated by the install day.
 */
export const ANYA_STORY_ENTRY = {
	id: 'anya',
	dataSpaceId: 'demo-anya-v1',
	storageName: 'tempience-triplit-demo-anya-v1',
	labelKey: 'demo.story.anya.space',
	descriptionKey: 'demo.story.anya.description',
	titleKey: 'demo.story.anya.title',
	bodyKey: 'demo.story.anya.body',
	openKey: 'demo.story.anya.open',
	manifestPrefix: 'anya-v1',
	recordPrefix: 'anya-',
	timezone: 'Europe/Belgrade',
	captureTime: '21:00',
	startId: 't.start',
	startAtInstall: true,
	locales: ['ru', 'en'],
	seedMarkerKey: 'tempience.demo.anya.seed',
	dismissedKey: 'tempience.demo.anya.dismissed',
	load: async (): Promise<DemoStory> => (await import('./story-anya')).ANYA_STORY
} as const satisfies DemoStoryEntry;

/** Every demo story the build offers, in the order the catalog shows them. */
export const DEMO_STORIES = [
	WATSON_STORY,
	ANYA_STORY_ENTRY
] as const satisfies readonly DemoStoryEntry[];

/** The DataSpace ids the registry owns; the built-in union grows with the registry. */
export type DemoDataSpaceId = (typeof DEMO_STORIES)[number]['dataSpaceId'];

/** The same entries read as the common type: no caller depends on how many there are. */
const ENTRIES: readonly DemoStoryEntry[] = DEMO_STORIES;

export const demoStoryById = (id: unknown): DemoStoryEntry | null =>
	ENTRIES.find((entry) => entry.id === id) ?? null;

export const demoStoryOfDataSpace = (dataSpaceId: unknown): DemoStoryEntry | null =>
	ENTRIES.find((entry) => entry.dataSpaceId === dataSpaceId) ?? null;

export const isDemoDataSpaceId = (value: unknown): value is DemoDataSpaceId =>
	demoStoryOfDataSpace(value) !== null;

/** The stories written in one interface language; a story is never offered in another. */
export const demoStoriesFor = (locale: Locale): readonly DemoStoryEntry[] =>
	ENTRIES.filter((entry) => entry.locales.includes(locale));
