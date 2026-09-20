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
/**
 * Rows as a loop-005 build left them, `{ [candidateId]: colorSlot }`: stamped raw onto the
 * seeded Scopes right after the import, so an e2e can watch the read-time migration of a
 * stored slot to a hue (R1). Nothing outside the e2e-synthetic space reads this key.
 */
export const E2E_SYNTHETIC_LEGACY_SLOTS_KEY = 'tempience.e2e.legacy-colour-slots';

export type E2eSyntheticSeedStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type E2eSyntheticSeedBootstrapInput = {
	dataSpace: DataSpace;
	importRepository: Pick<ScenarioImportRepository, 'apply'>;
	clock: () => string;
	storage: E2eSyntheticSeedStorage;
	/** Writes a loop-005 `colorSlot` onto a stored Scope as that build did, bypassing the repository. */
	stampLegacySlot?: (scopeId: string, colorSlot: number) => Promise<void>;
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

const stampLegacySlots = async (
	storage: E2eSyntheticSeedStorage,
	mapping: Readonly<Record<string, string>>,
	stamp: E2eSyntheticSeedBootstrapInput['stampLegacySlot']
): Promise<void> => {
	const text = storage.getItem(E2E_SYNTHETIC_LEGACY_SLOTS_KEY);
	if (!text || !stamp) return;
	const slots = JSON.parse(text) as Record<string, number>;
	for (const [candidateId, colorSlot] of Object.entries(slots)) {
		const scopeId = mapping[candidateId];
		if (scopeId) await stamp(scopeId, colorSlot);
	}
};

export const bootstrapE2eSyntheticSeed = async ({
	dataSpace,
	importRepository,
	clock,
	storage,
	stampLegacySlot
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
		await stampLegacySlots(storage, receipt.mapping, stampLegacySlot);
		storage.setItem(E2E_SYNTHETIC_SEED_MARKER_KEY, manifest.manifestId);
	}
	return { status: 'applied', manifestId: manifest.manifestId, batch, receipt };
};
