import { base } from '$app/paths';
import catalog from './catalog.json';
import { OWNER_DATA_PACKS, PACKS_PATH, PUBLIC_DATA_PACKS } from './constants';
import type { DataPack } from './types';

export const DATA_PACKS = catalog as readonly DataPack[];
export const BELGRADE_DATA_PACK = DATA_PACKS.find((pack) => pack.id === 'belgrade')!;

export const availableDataPacks = (): readonly DataPack[] => {
	const publicBuild = import.meta.env.PUBLIC_BUILD === '1';
	const enabled = (
		import.meta.env.PUBLIC_DATA_PACKS ?? (publicBuild ? PUBLIC_DATA_PACKS : OWNER_DATA_PACKS)
	)
		.split(',')
		.map((id: string) => id.trim());
	return DATA_PACKS.filter((pack) => enabled.includes(pack.id) && (!publicBuild || pack.public));
};

/**
 * Only a pack the build offers can be opened. An installed replica of a pack the build no longer
 * lists is not offered any more (owner decision 2026-09-20: the Belgrade what-if space leaves the
 * owner's switcher); its stored data stays untouched and returns with a build that lists the pack.
 */
export const canOpenDataPack = (
	pack: DataPack,
	// Kept for the callers' contract; the seed marker no longer keeps a pack selectable.
	_storage: Pick<Storage, 'getItem'> | null
): boolean => {
	if (import.meta.env.PUBLIC_BUILD === '1' && !pack.public) return false;
	return availableDataPacks().some((item) => item.id === pack.id);
};

export const loadDataPack = async (pack: DataPack): Promise<unknown> => {
	if (!availableDataPacks().some((item) => item.id === pack.id)) {
		throw new Error('Этот набор не включён в текущую сборку.');
	}
	const response = await fetch(`${base}${PACKS_PATH}/${pack.id}.json`, { cache: 'no-store' });
	if (!response.ok) throw new Error(`Не удалось загрузить набор: HTTP ${response.status}.`);
	return response.json();
};
