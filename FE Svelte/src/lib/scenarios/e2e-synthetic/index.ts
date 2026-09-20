import { activeDataSpace, triplit } from '$lib/state/triplit/client';
import { scenarioImportRepository } from '$lib/state/triplit';
import { bootstrapE2eSyntheticSeed, type E2eSyntheticSeedBootstrapResult } from './bootstrap';

let activeBootstrap: Promise<E2eSyntheticSeedBootstrapResult> | null = null;

export const ensureActiveE2eSyntheticSeed = (): Promise<E2eSyntheticSeedBootstrapResult> => {
	activeBootstrap ??= bootstrapE2eSyntheticSeed({
		dataSpace: activeDataSpace,
		importRepository: scenarioImportRepository,
		clock: () => new Date().toISOString(),
		storage: window.localStorage,
		// A raw row of an older build, for the migration e2e: the slot column alone, no hue.
		stampLegacySlot: (scopeId, colorSlot) => triplit.update('scopes', scopeId, { colorSlot })
	});
	return activeBootstrap;
};
