import { locale } from '$lib/state/Locale/Locale.svelte';
import { scenarioImportRepository, tempienceRepository } from '$lib/state/triplit';
import { activeDataSpace } from '$lib/state/triplit/client';
import { bootstrapDemoSeed } from './bootstrap';
import { demoStoryOfDataSpace } from './registry';
import type { DemoSeedBootstrapResult } from './types';

export { bootstrapDemoSeed } from './bootstrap';
export { buildDemoSeed, demoManifestId, demoRecordId } from './batch';
export type * from './types';

let activeBootstrap: Promise<DemoSeedBootstrapResult> | null = null;

/** The active replica is seeded from the story of its own DataSpace, and from no other. */
const seedActiveDemo = async (): Promise<DemoSeedBootstrapResult> => {
	const entry = demoStoryOfDataSpace(activeDataSpace.id);
	if (!entry) return { status: 'skipped', reason: 'not-target', manifestId: '' };
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
