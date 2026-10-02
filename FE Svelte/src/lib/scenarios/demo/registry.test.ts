import { describe, expect, it } from 'vitest';
import { DATA_SPACES, listDataSpaceOptions } from '$lib/state/triplit/data-space';
import type { DemoStoryEntry } from './registry';
import { demoManifestId, demoRecordId } from './batch';
import {
	ANYA_STORY_ENTRY,
	DEMO_STORIES,
	WATSON_STORY,
	demoStoriesFor,
	demoStoryById,
	demoStoryOfDataSpace,
	isDemoDataSpaceId
} from './registry';

const emptyStorage = { getItem: () => null, setItem: () => {} };

describe('the registry of demo stories', () => {
	it('finds a story by its id and by its DataSpace, and knows no other space', () => {
		expect(demoStoryById('watson')).toBe(WATSON_STORY);
		expect(demoStoryById('nobody')).toBeNull();
		expect(demoStoryOfDataSpace('demo-v1')).toBe(WATSON_STORY);
		expect(demoStoryOfDataSpace('canonical')).toBeNull();
		expect(demoStoryOfDataSpace(undefined)).toBeNull();
		expect(isDemoDataSpaceId('demo-v1')).toBe(true);
		expect(isDemoDataSpaceId('belgrade-what-if-v1')).toBe(false);
	});

	it('offers a story only in the languages it is written in', () => {
		for (const locale of ['ru', 'en'] as const) {
			expect(demoStoriesFor(locale)).toEqual(
				(DEMO_STORIES as readonly DemoStoryEntry[]).filter((entry) =>
					entry.locales.includes(locale)
				)
			);
			for (const entry of demoStoriesFor(locale)) expect(entry.locales, entry.id).toContain(locale);
		}
		// Both notebooks are written in both languages, so both catalogs offer both.
		for (const locale of ['ru', 'en'] as const)
			expect(demoStoriesFor(locale)).toEqual([WATSON_STORY, ANYA_STORY_ENTRY]);
	});

	it('derives one isolated DataSpace per story, offered right after the personal data', () => {
		const offered = listDataSpaceOptions(emptyStorage).map((space) => space.id);
		for (const entry of DEMO_STORIES) {
			const space = DATA_SPACES[entry.dataSpaceId as keyof typeof DATA_SPACES];
			expect(space, entry.id).toMatchObject({
				id: entry.dataSpaceId,
				kind: 'scenario',
				syncEnabled: false,
				storageName: entry.storageName,
				labelKey: entry.labelKey,
				descriptionKey: entry.descriptionKey
			});
			expect(offered, entry.id).toContain(entry.dataSpaceId);
		}
		// No two stories share a replica, a seed marker or a dismiss flag.
		for (const key of ['storageName', 'seedMarkerKey', 'dismissedKey', 'recordPrefix'] as const) {
			expect(new Set(DEMO_STORIES.map((entry) => entry[key])).size, key).toBe(DEMO_STORIES.length);
		}
	});

	it("keeps Watson's ids, keys and manifest exactly as the first release wrote them", () => {
		expect(WATSON_STORY).toMatchObject({
			id: 'watson',
			dataSpaceId: 'demo-v1',
			storageName: 'tempience-triplit-demo-v1',
			labelKey: 'demo.space.label',
			descriptionKey: 'demo.space.description',
			manifestPrefix: 'watson-v1',
			recordPrefix: 'demo-',
			timezone: 'Europe/London',
			captureTime: '12:00',
			startId: 'w.start',
			startAtInstall: false,
			seedMarkerKey: 'tempience.demo.seed',
			dismissedKey: 'tempience.demo.dismissed'
		});
		expect(WATSON_STORY.locales).toEqual(['ru', 'en']);
		// An existing install must never reseed: these strings are the ones already in storage.
		expect(demoRecordId(WATSON_STORY, 'w.start')).toBe('demo-w-start');
		expect(demoRecordId(WATSON_STORY, 's.hound')).toBe('demo-s-hound');
		expect(demoManifestId(WATSON_STORY, 'ru')).toBe('watson-v1:ru');
		expect(demoManifestId(WATSON_STORY, 'en')).toBe('watson-v1:en');
	});

	it('loads each story module on demand, and it holds the first page the entry names', async () => {
		for (const entry of DEMO_STORIES) {
			const story = await entry.load();
			expect(
				story.traces.some((trace) => trace.id === entry.startId),
				entry.id
			).toBe(true);
			expect(story.scopes.length, entry.id).toBeGreaterThan(0);
		}
	});
});
