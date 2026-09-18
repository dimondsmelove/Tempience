import { parseCalibrationManifest } from '../belgrade/calibration-manifest';
import { prepareScenarioImport } from '../belgrade/scenario-import';
import { E2E_SYNTHETIC_DATA_SPACE_ID, type DataSpace } from '$lib/state/triplit/data-space';
import type {
	ScenarioImportBatch,
	ScenarioImportReceipt,
	ScenarioImportRepository
} from '$lib/state/triplit/scenario-import-repository';

/**
 * Manifest text the e2e harness writes before the app boots. The fixtures themselves live only in
 * `e2e/fixtures/*.synthetic.json`; nothing in `src` duplicates them.
 */
export const E2E_SYNTHETIC_MANIFEST_KEY = 'tempience.e2e.scenario-manifest';
export const E2E_SYNTHETIC_SEED_MARKER_KEY = 'tempience.e2e.scenario-seed';

export type E2eSyntheticSeedStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type E2eSyntheticSeedBootstrapInput = {
	dataSpace: DataSpace;
	importRepository: Pick<ScenarioImportRepository, 'apply'>;
	clock: () => string;
	storage: E2eSyntheticSeedStorage;
};

export type E2eSyntheticSeedBootstrapResult =
	| { status: 'skipped'; reason: 'not-target' | 'no-manifest' | 'marker' }
	| {
			status: 'applied';
			manifestId: string;
			batch: ScenarioImportBatch;
			receipt: ScenarioImportReceipt;
	  };

const skipped = (
	reason: 'not-target' | 'no-manifest' | 'marker'
): E2eSyntheticSeedBootstrapResult => ({ status: 'skipped', reason });

export const bootstrapE2eSyntheticSeed = async ({
	dataSpace,
	importRepository,
	clock,
	storage
}: E2eSyntheticSeedBootstrapInput): Promise<E2eSyntheticSeedBootstrapResult> => {
	if (
		dataSpace.id !== E2E_SYNTHETIC_DATA_SPACE_ID ||
		dataSpace.kind !== 'scenario' ||
		dataSpace.syncEnabled
	) {
		return skipped('not-target');
	}

	const manifestText = storage.getItem(E2E_SYNTHETIC_MANIFEST_KEY);
	if (!manifestText) return skipped('no-manifest');

	const manifest = parseCalibrationManifest(JSON.parse(manifestText));
	if (storage.getItem(E2E_SYNTHETIC_SEED_MARKER_KEY) === manifest.manifestId) {
		return skipped('marker');
	}

	const batch = prepareScenarioImport({
		manifest,
		target: dataSpace,
		capturedAt: clock()
	});
	const receipt = await importRepository.apply(batch);
	if (receipt.failures.length === 0) {
		storage.setItem(E2E_SYNTHETIC_SEED_MARKER_KEY, manifest.manifestId);
	}
	return { status: 'applied', manifestId: manifest.manifestId, batch, receipt };
};
