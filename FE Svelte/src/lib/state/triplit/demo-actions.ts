import { CodedError } from '$lib/model/Errors/CodedError';
import { DEMO_MANIFEST_PREFIX } from '$lib/scenarios/demo/constants';
import { isLocale } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import {
	type DataSpace,
	type DataSpaceStorage,
	DEMO_DATA_SPACE_ID,
	DEMO_SEED_MARKER_KEY,
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
 * «Открыть записную книжку Ватсона» from any host — the tour's card, the link on the first
 * Scope, the local-data menu: the space is offered again if it was dismissed, becomes active,
 * and the app reloads into it; the seed runs on boot and asks the workbench to open on the
 * notebook's first page. A host that may hold an open form asks the draft guard before calling
 * this.
 */
export const openDemoAndReload = (reload: () => void = reloadPage): void => {
	restoreDemoDataSpace();
	reload();
};

/**
 * «Удалить демо» from any host — the space menu, the local-data menu: the replica goes whole,
 * the space stops being offered, and the app reloads into «Мои данные». A refusal is thrown
 * to the host, which shows it in its own place.
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
 * The language the demo replica was seeded in, read from the seed marker `watson-v1:<locale>`;
 * `null` when the marker is missing, names an unknown language or is not a Watson seed at all.
 */
export const demoSeedLocale = (
	storage: Pick<DataSpaceStorage, 'getItem'> | null = browserStorage()
): Locale | null => {
	let marker: string | null;
	try {
		marker = storage?.getItem(DEMO_SEED_MARKER_KEY) ?? null;
	} catch {
		return null;
	}
	if (!marker) return null;
	const [prefix, language, ...rest] = marker.split(':');
	return prefix === DEMO_MANIFEST_PREFIX && rest.length === 0 && isLocale(language)
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
 * in the language of the moment and opens on the notebook's first page. Refused unless the
 * demo is the active space, so no other replica can be emptied this way.
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
	if (readActiveDataSpaceId(storage) !== DEMO_DATA_SPACE_ID)
		throw new CodedError('data_space_reseed_demo', 'Пересобрать так можно только демо.');
	await target.clear({ full: true });
	removeKey(storage, DEMO_SEED_MARKER_KEY);
	reload();
};
