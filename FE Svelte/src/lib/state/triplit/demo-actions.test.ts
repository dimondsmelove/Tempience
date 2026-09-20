import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	CANONICAL_DATA_SPACE_ID,
	DATA_SPACES,
	DATA_SPACE_STORAGE_KEY,
	DEMO_DATA_SPACE_ID,
	DEMO_DISMISSED_KEY,
	DEMO_SEED_MARKER_KEY,
	readActiveDataSpaceId
} from './data-space';
import {
	deleteDemoAndReload,
	demoSeedLocale,
	isDemoUntouched,
	openDemoAndReload,
	reseedDemoAndReload
} from './demo-actions';
import type { Log } from './types';

const store = new Map<string, string>();
const storage = {
	getItem: (key: string) => store.get(key) ?? null,
	setItem: (key: string, value: string) => void store.set(key, value),
	removeItem: (key: string) => void store.delete(key),
	key: (index: number) => [...store.keys()][index] ?? null,
	get length() {
		return store.size;
	}
};

const log = (actor: Log['actor'], cause: Log['cause'] = 'normal'): Log => ({
	id: `log-${actor}-${cause}`,
	operationId: 'op',
	entityType: 'trace',
	entityId: 'demo-w-start',
	action: 'created',
	patch: {},
	occurredAt: '2026-09-20T10:00:00.000Z',
	deviceId: 'device',
	actor,
	cause
});

const repositoryWith = (logs: Log[]) => ({ listLogs: vi.fn().mockResolvedValue(logs) });

afterEach(() => {
	store.clear();
	vi.unstubAllGlobals();
});

describe('demo actions', () => {
	it('opens the demo: offered again after a dismiss, active, then the app reloads', () => {
		vi.stubGlobal('localStorage', storage);
		storage.setItem(DEMO_DISMISSED_KEY, '1');
		const reload = vi.fn();
		openDemoAndReload(reload);
		expect(storage.getItem(DEMO_DISMISSED_KEY)).toBeNull();
		expect(readActiveDataSpaceId(storage)).toBe(DEMO_DATA_SPACE_ID);
		expect(reload).toHaveBeenCalledOnce();
	});

	it('deletes the demo whole, hides the space, opens the own data, then reloads', async () => {
		vi.stubGlobal('localStorage', storage);
		storage.setItem(DEMO_SEED_MARKER_KEY, 'demo-v1:ru');
		const clear = vi.fn<(options?: { full?: boolean }) => Promise<void>>().mockResolvedValue();
		const reload = vi.fn();
		await deleteDemoAndReload(DATA_SPACES[DEMO_DATA_SPACE_ID], { clear }, reload);
		expect(clear).toHaveBeenCalledExactlyOnceWith({ full: true });
		expect(storage.getItem(DEMO_SEED_MARKER_KEY)).toBeNull();
		expect(storage.getItem(DEMO_DISMISSED_KEY)).toBe('1');
		expect(readActiveDataSpaceId(storage)).toBe(CANONICAL_DATA_SPACE_ID);
		expect(reload).toHaveBeenCalledOnce();
	});

	it('leaves the page as it is when the delete is refused', async () => {
		vi.stubGlobal('localStorage', storage);
		const clear = vi.fn<(options?: { full?: boolean }) => Promise<void>>().mockResolvedValue();
		const reload = vi.fn();
		await expect(
			deleteDemoAndReload(DATA_SPACES[CANONICAL_DATA_SPACE_ID], { clear }, reload)
		).rejects.toMatchObject({ code: 'data_space_dismiss_demo' });
		expect(clear).not.toHaveBeenCalled();
		expect(reload).not.toHaveBeenCalled();
	});
});

describe('the language the demo was seeded in', () => {
	it('reads the locale of a Watson seed marker', () => {
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:ru');
		expect(demoSeedLocale(storage)).toBe('ru');
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:en');
		expect(demoSeedLocale(storage)).toBe('en');
	});

	it.each([
		['a missing marker', null],
		['an empty marker', ''],
		['another manifest', 'demo-v1:ru'],
		['an unknown language', 'watson-v1:de'],
		['no language', 'watson-v1'],
		['a trailing part', 'watson-v1:ru:extra'],
		['garbage', '::watson-v1::']
	])('knows no language for %s', (_case, marker) => {
		if (marker !== null) storage.setItem(DEMO_SEED_MARKER_KEY, marker);
		expect(demoSeedLocale(storage)).toBeNull();
	});

	it('knows no language without storage or when storage refuses to answer', () => {
		expect(demoSeedLocale(null)).toBeNull();
		expect(
			demoSeedLocale({
				getItem: () => {
					throw new Error('denied');
				}
			})
		).toBeNull();
	});

	it('reads the browser storage by default', () => {
		vi.stubGlobal('localStorage', storage);
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:en');
		expect(demoSeedLocale()).toBe('en');
	});
});

describe('whether the demo is untouched', () => {
	it("is untouched while every journal entry is the seed's", async () => {
		await expect(isDemoUntouched(repositoryWith([]))).resolves.toBe(true);
		await expect(
			isDemoUntouched(repositoryWith([log('system'), log('system', 'import'), log('ai')]))
		).resolves.toBe(true);
	});

	it('is touched once the user wrote anything, whatever else the journal holds', async () => {
		await expect(isDemoUntouched(repositoryWith([log('user')]))).resolves.toBe(false);
		await expect(
			isDemoUntouched(repositoryWith([log('system'), log('user', 'undo'), log('system', 'import')]))
		).resolves.toBe(false);
	});

	it("reads the whole journal, not one record's", async () => {
		const repository = repositoryWith([]);
		await isDemoUntouched(repository);
		expect(repository.listLogs).toHaveBeenCalledExactlyOnceWith();
	});
});

describe('reseeding the demo in the interface language', () => {
	const demoActive = (): void => {
		storage.setItem(DATA_SPACE_STORAGE_KEY, DEMO_DATA_SPACE_ID);
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:ru');
		storage.setItem('tempience-locale', 'en');
	};

	it('clears the replica, drops only the seed marker, keeps the demo active and offered, reloads', async () => {
		demoActive();
		const clear = vi.fn<(options?: { full?: boolean }) => Promise<void>>().mockResolvedValue();
		const reload = vi.fn();
		await reseedDemoAndReload({ clear }, storage, reload);
		expect(clear).toHaveBeenCalledExactlyOnceWith({ full: true });
		expect(storage.getItem(DEMO_SEED_MARKER_KEY)).toBeNull();
		expect(storage.getItem(DEMO_DISMISSED_KEY)).toBeNull();
		expect(readActiveDataSpaceId(storage)).toBe(DEMO_DATA_SPACE_ID);
		expect(storage.getItem('tempience-locale')).toBe('en');
		expect(reload).toHaveBeenCalledOnce();
	});

	it('keeps a marker no reader accepts when storage cannot remove keys', async () => {
		demoActive();
		const minimal = { getItem: storage.getItem, setItem: storage.setItem };
		const clear = vi.fn<(options?: { full?: boolean }) => Promise<void>>().mockResolvedValue();
		const reload = vi.fn();
		await reseedDemoAndReload({ clear }, minimal, reload);
		expect(storage.getItem(DEMO_SEED_MARKER_KEY)).toBe('');
		expect(demoSeedLocale(storage)).toBeNull();
		expect(reload).toHaveBeenCalledOnce();
	});

	it('uses the browser storage by default', async () => {
		vi.stubGlobal('localStorage', storage);
		demoActive();
		const clear = vi.fn<(options?: { full?: boolean }) => Promise<void>>().mockResolvedValue();
		const reload = vi.fn();
		await reseedDemoAndReload({ clear }, undefined, reload);
		expect(clear).toHaveBeenCalledOnce();
		expect(storage.getItem(DEMO_SEED_MARKER_KEY)).toBeNull();
		expect(reload).toHaveBeenCalledOnce();
	});

	it("refuses to empty any replica but the active demo's", async () => {
		storage.setItem(DATA_SPACE_STORAGE_KEY, CANONICAL_DATA_SPACE_ID);
		storage.setItem(DEMO_SEED_MARKER_KEY, 'watson-v1:ru');
		const clear = vi.fn<(options?: { full?: boolean }) => Promise<void>>().mockResolvedValue();
		const reload = vi.fn();
		await expect(reseedDemoAndReload({ clear }, storage, reload)).rejects.toMatchObject({
			code: 'data_space_reseed_demo'
		});
		expect(clear).not.toHaveBeenCalled();
		expect(storage.getItem(DEMO_SEED_MARKER_KEY)).toBe('watson-v1:ru');
		expect(reload).not.toHaveBeenCalled();
	});

	it('refuses without browser storage', async () => {
		const clear = vi.fn<(options?: { full?: boolean }) => Promise<void>>().mockResolvedValue();
		const reload = vi.fn();
		await expect(reseedDemoAndReload({ clear }, null, reload)).rejects.toMatchObject({
			code: 'data_space_storage'
		});
		expect(clear).not.toHaveBeenCalled();
		expect(reload).not.toHaveBeenCalled();
	});

	it('leaves the marker and the page when the clear fails', async () => {
		demoActive();
		const clear = vi
			.fn<(options?: { full?: boolean }) => Promise<void>>()
			.mockRejectedValue(new Error('IndexedDB is busy'));
		const reload = vi.fn();
		await expect(reseedDemoAndReload({ clear }, storage, reload)).rejects.toThrow(
			'IndexedDB is busy'
		);
		expect(storage.getItem(DEMO_SEED_MARKER_KEY)).toBe('watson-v1:ru');
		expect(reload).not.toHaveBeenCalled();
	});
});
