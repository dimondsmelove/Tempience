import { demoUpdate } from '$lib/state/DemoUpdate/DemoUpdate.svelte';
import { locale } from '$lib/state/Locale/Locale.svelte';
import { scenarioImportRepository, tempienceRepository } from '$lib/state/triplit';
import { activeDataSpace, triplit } from '$lib/state/triplit/client';
import { isDemoUntouched, reseedDemoAndReload } from '$lib/state/triplit/demo-actions';
import { bootstrapDemoSeed } from './bootstrap';
import { demoFreshness } from './freshness';
import { demoStoryOfDataSpace, type DemoStoryEntry } from './registry';
import type { DemoSeedBootstrapResult } from './types';

export { bootstrapDemoSeed } from './bootstrap';
export { buildDemoSeed, demoManifestId, demoRecordId } from './batch';
export type * from './types';

let activeBootstrap: Promise<DemoSeedBootstrapResult> | null = null;

/**
 * A notebook seeded from other content than this build ships is brought up to date (owner,
 * 2026-09-29): untouched, it is rebuilt at once — the replica cleared, the app reloaded and
 * seeded again; with the reader's own entries it is left as it is and the header offers the
 * rebuild. Returns whether the page is reloading.
 */
const refreshOutdatedDemo = async (entry: DemoStoryEntry): Promise<boolean> => {
	const storage = window.localStorage;
	const freshness = demoFreshness(entry, await entry.load(), storage);
	if (freshness !== 'outdated') return false;
	if (!(await isDemoUntouched(tempienceRepository))) {
		demoUpdate.available = true;
		return false;
	}
	await reseedDemoAndReload(triplit, storage);
	return true;
};

/** The active replica is seeded from the story of its own DataSpace, and from no other. */
const seedActiveDemo = async (): Promise<DemoSeedBootstrapResult> => {
	const entry = demoStoryOfDataSpace(activeDataSpace.id);
	if (!entry) return { status: 'skipped', reason: 'not-target', manifestId: '' };
	if (await refreshOutdatedDemo(entry))
		return { status: 'skipped', reason: 'refreshing', manifestId: '' };
	return bootstrapDemoSeed({
		dataSpace: activeDataSpace,
		entry,
		repository: tempienceRepository,
		importRepository: scenarioImportRepository,
		clock: () => new Date().toISOString(),
		storage: window.localStorage,
		locale: locale.current
	});
};

/** A demo replica is seeded once per app load, in the interface language of the moment. */
export const ensureActiveDemoSeed = (): Promise<DemoSeedBootstrapResult> => {
	activeBootstrap ??= seedActiveDemo();
	return activeBootstrap;
};
