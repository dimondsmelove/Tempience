import { locale } from '$lib/state/Locale/Locale.svelte';
import { scenarioImportRepository, tempienceRepository } from '$lib/state/triplit';
import { activeDataSpace } from '$lib/state/triplit/client';
import { bootstrapDemoSeed } from './bootstrap';
import type { DemoSeedBootstrapResult } from './types';

export { bootstrapDemoSeed } from './bootstrap';
export { buildDemoSeed, demoManifestId, demoRecordId } from './batch';
export type * from './types';

let activeBootstrap: Promise<DemoSeedBootstrapResult> | null = null;

/** The demo replica is seeded once per app load, in the interface language of the moment. */
export const ensureActiveDemoSeed = (): Promise<DemoSeedBootstrapResult> => {
	activeBootstrap ??= bootstrapDemoSeed({
		dataSpace: activeDataSpace,
		repository: tempienceRepository,
		importRepository: scenarioImportRepository,
		clock: () => new Date().toISOString(),
		storage: window.localStorage,
		locale: locale.current
	});
	return activeBootstrap;
};
