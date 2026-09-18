import { BELGRADE_DATA_PACK } from '../DataPacks/DataPacks';
import {
	bootstrapDataPack,
	type DataPackBootstrapInput,
	type DataPackBootstrapResult
} from '../DataPacks/Bootstrap';

export type {
	DataPackRepository as BelgradeSeedRepository,
	DataPackMarkerStorage as BelgradeSeedMarkerStorage
} from '../DataPacks/Bootstrap';

export type BelgradeSeedBootstrapInput = Omit<DataPackBootstrapInput, 'pack'>;
export type BelgradeSeedBootstrapResult = DataPackBootstrapResult;
export const BELGRADE_SEED_MANIFEST_ID = BELGRADE_DATA_PACK.manifestId;
export const BELGRADE_SEED_MARKER_KEY = BELGRADE_DATA_PACK.markerKey;
export const BELGRADE_SEED_MARKER_VALUE = BELGRADE_SEED_MANIFEST_ID;

export const bootstrapBelgradeSeed = (
	input: BelgradeSeedBootstrapInput
): Promise<BelgradeSeedBootstrapResult> =>
	bootstrapDataPack({ ...input, pack: BELGRADE_DATA_PACK });
