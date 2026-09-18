import { activeDataSpace } from '$lib/state/triplit/client';
import { scenarioImportRepository } from '$lib/state/triplit';
import { bootstrapE2eSyntheticSeed, type E2eSyntheticSeedBootstrapResult } from './bootstrap';

let activeBootstrap: Promise<E2eSyntheticSeedBootstrapResult> | null = null;

export const ensureActiveE2eSyntheticSeed = (): Promise<E2eSyntheticSeedBootstrapResult> => {
	activeBootstrap ??= bootstrapE2eSyntheticSeed({
		dataSpace: activeDataSpace,
		importRepository: scenarioImportRepository,
		clock: () => new Date().toISOString(),
		storage: window.localStorage
	});
	return activeBootstrap;
};
