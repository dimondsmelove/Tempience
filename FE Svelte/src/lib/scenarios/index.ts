import { activeDataSpace } from '$lib/state/triplit/client';
import { E2E_SYNTHETIC_DATA_SPACE_ID } from '$lib/state/triplit/data-space';
import { DATA_PACKS } from './DataPacks/DataPacks';

/** The selected pack is installed in its isolated replica before readers mount. */
export const ensureActiveScenarioSeed = async (): Promise<void> => {
	if (import.meta.env.PUBLIC_BUILD !== '1' && activeDataSpace.id === E2E_SYNTHETIC_DATA_SPACE_ID) {
		await (await import('./e2e-synthetic')).ensureActiveE2eSyntheticSeed();
		return;
	}
	if (DATA_PACKS.some((pack) => pack.dataSpaceId === activeDataSpace.id)) {
		await (await import('./DataPacks/instance')).ensureActiveDataPack();
	}
};
