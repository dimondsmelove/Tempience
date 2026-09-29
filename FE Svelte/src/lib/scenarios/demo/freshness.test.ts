import { describe, expect, it } from 'vitest';
import { demoContentHash, demoContentKey, demoFreshness } from './freshness';
import { ANYA_STORY_ENTRY, WATSON_STORY } from './registry';
import { DEMO_STORY } from './story';
import type { DemoStory } from './types';

const storageOf = (values: Record<string, string>) => ({
	getItem: (key: string) => values[key] ?? null
});

describe('demo freshness', () => {
	const ru = demoContentHash(WATSON_STORY, DEMO_STORY, 'ru');

	it('fingerprints the seed: stable, per language, changed by any content', () => {
		expect(demoContentHash(WATSON_STORY, DEMO_STORY, 'ru')).toBe(ru);
		expect(demoContentHash(WATSON_STORY, DEMO_STORY, 'en')).not.toBe(ru);
		const fewer: DemoStory = { ...DEMO_STORY, chapters: DEMO_STORY.chapters.slice(1) };
		expect(demoContentHash(WATSON_STORY, fewer, 'ru')).not.toBe(ru);
		const recoloured: DemoStory = {
			...DEMO_STORY,
			scopes: DEMO_STORY.scopes.map((scope, index) =>
				index === 0 ? { ...scope, colour: { hue: 1 } } : scope
			)
		};
		expect(demoContentHash(WATSON_STORY, recoloured, 'ru')).not.toBe(ru);
	});

	it('tells a fresh replica from an outdated one and from one never seeded', () => {
		const marker = WATSON_STORY.seedMarkerKey;
		const key = demoContentKey(WATSON_STORY);
		expect(key).toBe('tempience.demo.seed.content');
		expect(demoContentKey(ANYA_STORY_ENTRY)).toBe('tempience.demo.anya.seed.content');
		expect(demoFreshness(WATSON_STORY, DEMO_STORY, storageOf({}))).toBe('unseeded');
		expect(
			demoFreshness(WATSON_STORY, DEMO_STORY, storageOf({ [marker]: 'watson-v1:ru', [key]: ru }))
		).toBe('fresh');
		// Seeded before fingerprints existed, or from other content.
		expect(demoFreshness(WATSON_STORY, DEMO_STORY, storageOf({ [marker]: 'watson-v1:ru' }))).toBe(
			'outdated'
		);
		expect(
			demoFreshness(WATSON_STORY, DEMO_STORY, storageOf({ [marker]: 'watson-v1:ru', [key]: 'x' }))
		).toBe('outdated');
		// The language of the seed decides which fingerprint is expected.
		expect(
			demoFreshness(WATSON_STORY, DEMO_STORY, storageOf({ [marker]: 'watson-v1:en', [key]: ru }))
		).toBe('outdated');
	});
});
