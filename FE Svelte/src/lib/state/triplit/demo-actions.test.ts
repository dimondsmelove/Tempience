import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	CANONICAL_DATA_SPACE_ID,
	DATA_SPACES,
	DEMO_DATA_SPACE_ID,
	DEMO_DISMISSED_KEY,
	DEMO_SEED_MARKER_KEY,
	readActiveDataSpaceId
} from './data-space';
import { deleteDemoAndReload, openDemoAndReload } from './demo-actions';

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
