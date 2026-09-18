import { CodedError } from '$lib/model/Errors/CodedError';
import type { MessageKey } from '$lib/state/Locale/types';
import { createId } from './ids';
import { DATA_PACKS, canOpenDataPack } from '$lib/scenarios/DataPacks/DataPacks';

export const CANONICAL_DATA_SPACE_ID = 'canonical';
export const BELGRADE_SCENARIO_DATA_SPACE_ID = 'belgrade-what-if-v1';
export const E2E_SYNTHETIC_DATA_SPACE_ID = 'e2e-synthetic';
export const DATA_SPACE_STORAGE_KEY = 'tempience.data-space.active';
// Test-only opt-in. Without this flag `e2e-synthetic` is not a valid DataSpace id, so it cannot be
// reached from the switcher, from a stale persisted value or by hand.
export const E2E_SYNTHETIC_ENABLED_KEY = 'tempience.e2e.data-space-enabled';

export type BuiltInDataSpaceId =
	| typeof CANONICAL_DATA_SPACE_ID
	| typeof BELGRADE_SCENARIO_DATA_SPACE_ID
	| typeof E2E_SYNTHETIC_DATA_SPACE_ID;

export type ImportedDataSpaceId = `imported-${string}`;
export type DataSpaceId = BuiltInDataSpaceId | ImportedDataSpaceId;
const IMPORTED_DATA_SPACE_KEY = 'tempience.data-space.imported.';
const IMPORTED_ID_PATTERN =
	/^imported-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ScenarioDataSpaceId = Exclude<DataSpaceId, typeof CANONICAL_DATA_SPACE_ID>;

export type DataSpace = Readonly<{
	id: DataSpaceId;
	kind: 'canonical' | 'scenario';
	/** The name as registered: a scenario's own, an imported file's; the canonical one's is the interface's. */
	label: string;
	/** Given when the label is the interface's, not the user's or a scenario's own. */
	labelKey?: MessageKey;
	descriptionKey: MessageKey;
	storageName: string;
	syncEnabled: boolean;
}>;

/** The name shown for a space: the interface's own for the canonical one, the registered one otherwise. */
export const dataSpaceLabel = (space: DataSpace, translate: (key: MessageKey) => string): string =>
	space.labelKey ? translate(space.labelKey) : space.label;

export const DATA_SPACES: Readonly<Record<BuiltInDataSpaceId, DataSpace>> = {
	[CANONICAL_DATA_SPACE_ID]: {
		id: CANONICAL_DATA_SPACE_ID,
		kind: 'canonical',
		label: 'Мои данные',
		labelKey: 'dataSpace.mine',
		descriptionKey: 'dataSpace.description_canonical',
		storageName: 'tempience-triplit',
		syncEnabled: true
	},
	[BELGRADE_SCENARIO_DATA_SPACE_ID]: {
		id: BELGRADE_SCENARIO_DATA_SPACE_ID,
		kind: 'scenario',
		label: 'Белград · what-if',
		descriptionKey: 'dataSpace.description_scenario',
		storageName: 'tempience-triplit-belgrade-what-if-v1',
		syncEnabled: false
	},
	[E2E_SYNTHETIC_DATA_SPACE_ID]: {
		id: E2E_SYNTHETIC_DATA_SPACE_ID,
		kind: 'scenario',
		label: 'E2E · synthetic',
		descriptionKey: 'dataSpace.description_e2e',
		storageName: 'tempience-triplit-e2e-synthetic',
		syncEnabled: false
	}
};

type DataSpaceStorage = Pick<Storage, 'getItem' | 'setItem'> &
	Partial<Pick<Storage, 'key' | 'length'>>;
type DataSpaceResetTarget = {
	clear: (options?: { full?: boolean }) => Promise<void>;
};

const browserStorage = (): DataSpaceStorage | null => {
	if (typeof localStorage === 'undefined') return null;
	try {
		return localStorage;
	} catch {
		return null;
	}
};

const importedDataSpace = (id: ImportedDataSpaceId, label: string): DataSpace => ({
	id,
	kind: 'scenario',
	label,
	descriptionKey: 'dataSpace.description_imported',
	storageName: `tempience-triplit-${id}`,
	syncEnabled: false
});

export const isImportedDataSpaceId = (value: unknown): value is ImportedDataSpaceId =>
	typeof value === 'string' && IMPORTED_ID_PATTERN.test(value);

const readImportedDataSpace = (id: unknown, target: DataSpaceStorage | null): DataSpace | null => {
	if (!target || !isImportedDataSpaceId(id)) return null;
	try {
		const value: unknown = JSON.parse(target.getItem(IMPORTED_DATA_SPACE_KEY + id) ?? 'null');
		if (
			!value ||
			typeof value !== 'object' ||
			!('label' in value) ||
			typeof value.label !== 'string' ||
			!value.label.trim() ||
			value.label.length > 200
		)
			return null;
		// Storage identity and sync policy are derived from the registry key, never read from a file.
		return importedDataSpace(id, value.label);
	} catch {
		return null;
	}
};

export const readImportedDataSpaces = (
	target: DataSpaceStorage | null = browserStorage()
): DataSpace[] => {
	if (!target?.key || typeof target.length !== 'number') return [];
	const spaces: DataSpace[] = [];
	for (let index = 0; index < target.length; index++) {
		const key = target.key(index);
		if (!key?.startsWith(IMPORTED_DATA_SPACE_KEY)) continue;
		const space = readImportedDataSpace(key.slice(IMPORTED_DATA_SPACE_KEY.length), target);
		if (space) spaces.push(space);
	}
	return spaces.toSorted((a, b) => a.label.localeCompare(b.label));
};

export const createImportedDataSpace = (
	label: string,
	target: DataSpaceStorage | null = browserStorage()
): DataSpace => {
	const existing = new Set([
		...DATA_SPACE_OPTIONS.map((space) => space.label),
		...readImportedDataSpaces(target).map((space) => space.label)
	]);
	const original = label.trim().slice(0, 180);
	let unique = original;
	for (let copy = 2; existing.has(unique); copy++) unique = `${original} (${copy})`;
	return importedDataSpace(`imported-${createId()}`, unique);
};

export const registerImportedDataSpace = (
	space: DataSpace,
	target: DataSpaceStorage | null = browserStorage()
): void => {
	if (
		!target ||
		space.kind !== 'scenario' ||
		!space.label.trim() ||
		space.label.length > 200 ||
		!isImportedDataSpaceId(space.id) ||
		space.syncEnabled ||
		space.storageName !== `tempience-triplit-${space.id}`
	)
		throw new CodedError('data_space_register', 'Не удалось зарегистрировать локальную базу.');
	const key = IMPORTED_DATA_SPACE_KEY + space.id;
	if (target.getItem(key) !== null)
		throw new CodedError('data_space_registered', 'Эта локальная база уже зарегистрирована.');
	// One key per replica avoids losing another tab's registration in a shared array update.
	target.setItem(key, JSON.stringify({ label: space.label }));
};

export const DATA_SPACE_OPTIONS: readonly DataSpace[] = [
	DATA_SPACES[CANONICAL_DATA_SPACE_ID],
	...DATA_PACKS.filter((pack) => canOpenDataPack(pack, browserStorage())).map(
		(pack) => DATA_SPACES[pack.dataSpaceId]
	),
	...readImportedDataSpaces()
];

export const isE2eSyntheticEnabled = (
	target: DataSpaceStorage | null = browserStorage()
): boolean => {
	if (!target) return false;
	try {
		return target.getItem(E2E_SYNTHETIC_ENABLED_KEY) === '1';
	} catch {
		return false;
	}
};

export const isDataSpaceId = (
	value: unknown,
	target: DataSpaceStorage | null = browserStorage()
): value is DataSpaceId =>
	value === CANONICAL_DATA_SPACE_ID ||
	Boolean(readImportedDataSpace(value, target)) ||
	DATA_PACKS.some((pack) => pack.dataSpaceId === value && canOpenDataPack(pack, target)) ||
	(import.meta.env.PUBLIC_BUILD !== '1' &&
		value === E2E_SYNTHETIC_DATA_SPACE_ID &&
		isE2eSyntheticEnabled(target));

export const readActiveDataSpaceId = (
	target: DataSpaceStorage | null = browserStorage()
): DataSpaceId => {
	if (!target) return CANONICAL_DATA_SPACE_ID;
	try {
		const value = target.getItem(DATA_SPACE_STORAGE_KEY);
		return isDataSpaceId(value, target) ? value : CANONICAL_DATA_SPACE_ID;
	} catch {
		return CANONICAL_DATA_SPACE_ID;
	}
};

export const getActiveDataSpace = (
	target: DataSpaceStorage | null = browserStorage()
): DataSpace => {
	const id = readActiveDataSpaceId(target);
	return isImportedDataSpaceId(id)
		? (readImportedDataSpace(id, target) ?? DATA_SPACES[CANONICAL_DATA_SPACE_ID])
		: DATA_SPACES[id];
};

export const saveActiveDataSpaceId = (
	id: DataSpaceId,
	target: DataSpaceStorage | null = browserStorage()
): void => {
	if (!target)
		throw new CodedError(
			'data_space_storage',
			'Браузерное хранилище недоступно: DataSpace нельзя переключить.'
		);
	try {
		target.setItem(DATA_SPACE_STORAGE_KEY, id);
	} catch {
		throw new CodedError('data_space_save', 'Не удалось сохранить выбранный DataSpace.');
	}
};

export const resetScenarioDataSpace = async (
	dataSpace: DataSpace,
	target: DataSpaceResetTarget
): Promise<void> => {
	if (dataSpace.kind !== 'scenario') {
		throw new CodedError(
			'data_space_reset_canonical',
			'Сценарный reset нельзя применить к основным данным.'
		);
	}
	await target.clear({ full: true });
};
