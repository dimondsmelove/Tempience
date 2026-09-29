import type { Locale } from '$lib/state/Locale/types';
import { demoSeedLocale } from '$lib/state/triplit/demo-actions';
import { buildDemoSeed } from './batch';
import { DEMO_MANIFEST_VERSION } from './constants';
import type { DemoStoryEntry } from './registry';
import type { DemoFreshness, DemoSeedStorage, DemoStory } from './types';

/** Where a story's replica keeps the fingerprint of the content it was seeded with. */
export const demoContentKey = (entry: DemoStoryEntry): string => `${entry.seedMarkerKey}.content`;

/** The install instant is the only date not written in the story: it never counts as content. */
const FINGERPRINT_CAPTURED_AT = '2000-01-01T00:00:00.000Z';

/** FNV-1a, 32 bits: a short stable digest of the seed, not a secret. */
const digest = (text: string): string => {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
};

/**
 * The fingerprint of a story as it would be seeded in one language: every record, link,
 * chapter, colour and text of the seed. Any change to the story file or its texts changes it,
 * so a new build knows the notebook it installed earlier is out of date — no version to bump.
 */
export const demoContentHash = (entry: DemoStoryEntry, story: DemoStory, locale: Locale): string =>
	digest(
		JSON.stringify([
			DEMO_MANIFEST_VERSION,
			buildDemoSeed({ locale, capturedAt: FINGERPRINT_CAPTURED_AT, entry }, story),
			story.scopes
		])
	);

/**
 * Whether the replica holds the story this build ships: `unseeded` when it holds no seed of it,
 * `outdated` when it was seeded from other content (or before fingerprints existed).
 */
export const demoFreshness = (
	entry: DemoStoryEntry,
	story: DemoStory,
	storage: Pick<DemoSeedStorage, 'getItem'>
): DemoFreshness => {
	const locale = demoSeedLocale(entry, storage);
	if (locale === null) return 'unseeded';
	return storage.getItem(demoContentKey(entry)) === demoContentHash(entry, story, locale)
		? 'fresh'
		: 'outdated';
};
