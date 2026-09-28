import { CodedError } from '$lib/model/Errors/CodedError';
import type { DemoStoryEntry } from '$lib/scenarios/demo/registry';
import { demoStoryOfDataSpace } from '$lib/scenarios/demo/registry';
import { isLocale } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import {
	type DataSpace,
	type DataSpaceStorage,
	browserStorage,
	dismissDemoDataSpace,
	readActiveDataSpaceId,
	removeKey,
	restoreDemoDataSpace
} from './data-space';
import type { TraceRepository } from './Repository/types';

export type DemoResetTarget = Parameters<typeof dismissDemoDataSpace>[1];
const reloadPage = (): void => window.location.reload();

/**
 * «Открыть …» from any host — the tour's catalog, the first Scope, the local-data menu: the
 * story's space is offered again if it was dismissed, becomes active, and the app reloads into
 * it; the seed runs on boot and asks the workbench to open on that notebook's first page. A
 * host that may hold an open form asks the draft guard before calling this.
 */
export const openDemoAndReload = (entry: DemoStoryEntry, reload: () => void = reloadPage): void => {
	restoreDemoDataSpace(entry);
	reload();
};

/**
 * «Удалить демо» from any host — the space menu, the local-data menu: the replica of the space
 * given goes whole, that story stops being offered, and the app reloads into «Мои данные». A
 * refusal is thrown to the host, which shows it in its own place.
 */
export const deleteDemoAndReload = async (
	dataSpace: DataSpace,
	target: DemoResetTarget,
	reload: () => void = reloadPage
): Promise<void> => {
	await dismissDemoDataSpace(dataSpace, target);
	reload();
};

/**
 * The language one story's replica was seeded in, read from its seed marker
 * `<manifestPrefix>:<locale>`; `null` when the marker is missing, names an unknown language or
 * is not that story's seed at all.
 */
export const demoSeedLocale = (
	entry: DemoStoryEntry,
	storage: Pick<DataSpaceStorage, 'getItem'> | null = browserStorage()
): Locale | null => {
	let marker: string | null;
	try {
		marker = storage?.getItem(entry.seedMarkerKey) ?? null;
	} catch {
		return null;
	}
	if (!marker) return null;
	const [prefix, language, ...rest] = marker.split(':');
	return prefix === entry.manifestPrefix && rest.length === 0 && isLocale(language)
		? language
		: null;
};

/**
 * Whether the demo replica holds nothing of the reader's own: every write of the seed is the
 * system's (or an import's), so one journal entry by the user is one change worth keeping.
 */
export const isDemoUntouched = async (
	repository: Pick<TraceRepository, 'listLogs'>
): Promise<boolean> => !(await repository.listLogs()).some((log) => log.actor === 'user');

/**
 * The demo follows the interface language: the replica is cleared whole and the seed marker
 * goes with it, while the space stays active and offered; on the reload the seed runs again
 * in the language of the moment and opens on the notebook's first page. Runs on the active
 * demo and on no other space, so no other replica can be emptied this way.
 */
export const reseedDemoAndReload = async (
	target: DemoResetTarget,
	storage: DataSpaceStorage | null = browserStorage(),
	reload: () => void = reloadPage
): Promise<void> => {
	if (!storage)
		throw new CodedError(
			'data_space_storage',
			'Браузерное хранилище недоступно: DataSpace нельзя переключить.'
		);
	const entry = demoStoryOfDataSpace(readActiveDataSpaceId(storage));
	if (!entry) throw new CodedError('data_space_reseed_demo', 'Пересобрать так можно только демо.');
	await target.clear({ full: true });
	removeKey(storage, entry.seedMarkerKey);
	reload();
};
