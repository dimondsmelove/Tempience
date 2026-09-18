import { activeDataSpace } from '$lib/state/triplit/client';
import { scenarioImportRepository, tempienceRepository } from '$lib/state/triplit';
import { DATA_PACKS } from './DataPacks';
import { bootstrapDataPack, type DataPackBootstrapResult } from './Bootstrap';

let activeBootstrap: Promise<DataPackBootstrapResult> | null = null;

export const ensureActiveDataPack = (): Promise<DataPackBootstrapResult> => {
	const pack = DATA_PACKS.find((item) => item.dataSpaceId === activeDataSpace.id);
	if (!pack) throw new Error('Для выбранного пространства нет набора данных.');
	activeBootstrap ??= bootstrapDataPack({
		pack,
		dataSpace: activeDataSpace,
		repository: tempienceRepository,
		importRepository: scenarioImportRepository,
		clock: () => new Date().toISOString(),
		markerStorage: window.localStorage
	});
	return activeBootstrap;
};
