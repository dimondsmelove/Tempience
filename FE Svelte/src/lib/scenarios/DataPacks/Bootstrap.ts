import { parseCalibrationManifest } from '../belgrade/calibration-manifest';
import { prepareScenarioImport } from '../belgrade/scenario-import';
import type { DataSpace } from '$lib/state/triplit/data-space';
import { loadDataPack } from './DataPacks';
import type { DataPack } from './types';
import type { TraceRepository } from '$lib/state/triplit/repository';
import type { Log } from '$lib/state/triplit/types';
import type {
	ScenarioImportBatch,
	ScenarioImportReceipt,
	ScenarioImportRepository
} from '$lib/state/triplit/scenario-import-repository';

export type DataPackRepository = Pick<
	TraceRepository,
	| 'listLogs'
	| 'listTraces'
	| 'listScopes'
	| 'listPeriods'
	| 'listIntersections'
	| 'listScopeSegments'
>;

export type DataPackMarkerStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type DataPackBootstrapInput = {
	pack: DataPack;
	dataSpace: DataSpace;
	repository: DataPackRepository;
	importRepository: ScenarioImportRepository;
	clock: () => string;
	markerStorage: DataPackMarkerStorage;
};

export type DataPackBootstrapResult =
	| {
			status: 'skipped';
			reason: 'canonical' | 'not-target' | 'marker' | 'existing-import' | 'existing-data';
			manifestId: string;
	  }
	| {
			status: 'applied';
			manifestId: string;
			batch: ScenarioImportBatch;
			receipt: ScenarioImportReceipt;
	  };

type DataPackSkipReason =
	'canonical' | 'not-target' | 'marker' | 'existing-import' | 'existing-data';

const skipped = (pack: DataPack, reason: DataPackSkipReason): DataPackBootstrapResult => ({
	status: 'skipped',
	reason,
	manifestId: pack.manifestId
});

const record = (value: unknown): Record<string, unknown> | null =>
	value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const importedManifestId = (log: Pick<Log, 'cause' | 'patch'>): string | null => {
	if (log.cause !== 'import') return null;
	const patch = record(log.patch);
	const directImport = record(patch?.import);
	const afterImport = record(record(patch?.after)?.import);
	const imported = directImport ?? afterImport;
	return typeof imported?.manifestId === 'string' ? imported.manifestId : null;
};

export const bootstrapDataPack = async ({
	pack,
	dataSpace,
	repository,
	importRepository,
	clock,
	markerStorage
}: DataPackBootstrapInput): Promise<DataPackBootstrapResult> => {
	if (dataSpace.kind === 'canonical') return skipped(pack, 'canonical');
	if (dataSpace.id !== pack.dataSpaceId || dataSpace.kind !== 'scenario' || dataSpace.syncEnabled) {
		return skipped(pack, 'not-target');
	}
	if (markerStorage.getItem(pack.markerKey) === pack.manifestId) {
		return skipped(pack, 'marker');
	}

	const [logs, traces, scopes, periods, intersections, scopeSegments] = await Promise.all([
		repository.listLogs(),
		repository.listTraces(),
		repository.listScopes(),
		repository.listPeriods(),
		repository.listIntersections(),
		repository.listScopeSegments()
	]);
	if (logs.some((log) => importedManifestId(log) === pack.manifestId)) {
		markerStorage.setItem(pack.markerKey, pack.manifestId);
		return skipped(pack, 'existing-import');
	}
	if (
		logs.some((log) => log.cause === 'import') ||
		traces.length + scopes.length + periods.length + intersections.length + scopeSegments.length > 0
	) {
		markerStorage.setItem(pack.markerKey, pack.manifestId);
		return skipped(pack, 'existing-data');
	}

	const manifest = parseCalibrationManifest(await loadDataPack(pack));
	if (manifest.manifestId !== pack.manifestId)
		throw new Error('Версия набора не совпадает с каталогом.');
	const batch = prepareScenarioImport({
		manifest,
		target: dataSpace,
		capturedAt: clock()
	});
	const receipt = await importRepository.apply(batch);
	if (receipt.failures.length)
		throw new Error(receipt.failures.map((failure) => failure.reason).join('; '));
	markerStorage.setItem(pack.markerKey, pack.manifestId);
	return { status: 'applied', manifestId: pack.manifestId, batch, receipt };
};
