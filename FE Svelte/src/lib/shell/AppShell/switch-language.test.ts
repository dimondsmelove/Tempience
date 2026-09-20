import { describe, expect, it, vi } from 'vitest';
import { DEMO_SEED_MARKER_KEY } from '$lib/state/triplit/data-space';
import type { Log } from '$lib/state/triplit/types';
import { switchLanguage, type SwitchLanguageDeps } from './switch-language';

const userLog = {
	id: 'log-1',
	operationId: 'op',
	entityType: 'trace',
	entityId: 'trace-1',
	action: 'created',
	patch: {},
	occurredAt: '2026-09-20T10:00:00.000Z',
	deviceId: 'device',
	actor: 'user',
	cause: 'normal'
} satisfies Log;
const seedLog = { ...userLog, id: 'log-0', actor: 'system', cause: 'import' } satisfies Log;

type Setup = Partial<{
	space: string;
	marker: string | null;
	logs: Log[];
	proceed: boolean;
	storage: SwitchLanguageDeps['storage'];
}>;

const setup = ({
	space = 'demo-v1',
	marker = 'watson-v1:ru',
	logs = [seedLog],
	proceed = true,
	storage
}: Setup = {}) => {
	const store = new Map<string, string>();
	if (marker !== null) store.set(DEMO_SEED_MARKER_KEY, marker);
	const deps: SwitchLanguageDeps = {
		locale: { set: vi.fn() },
		activeDataSpace: { id: space as 'demo-v1' },
		repository: { listLogs: vi.fn().mockResolvedValue(logs) },
		triplit: { clear: vi.fn().mockResolvedValue(undefined) },
		storage:
			storage === undefined
				? {
						getItem: (key: string) => store.get(key) ?? null,
						setItem: (key: string, value: string) => void store.set(key, value),
						removeItem: (key: string) => void store.delete(key)
					}
				: storage,
		draftGuard: { confirmReloading: vi.fn().mockResolvedValue(proceed) },
		reseed: vi.fn().mockResolvedValue(undefined)
	};
	return deps;
};

describe('switching the interface language', () => {
	it('reseeds an untouched demo written in another language, after the reloading question', async () => {
		const deps = setup();
		await switchLanguage('en', deps);
		expect(deps.locale.set).toHaveBeenCalledExactlyOnceWith('en');
		expect(deps.repository.listLogs).toHaveBeenCalledOnce();
		expect(deps.draftGuard.confirmReloading).toHaveBeenCalledOnce();
		expect(deps.reseed).toHaveBeenCalledExactlyOnceWith(deps.triplit, deps.storage);
	});

	it('sets the language first, so the choice is kept even when the question is declined', async () => {
		const deps = setup({ proceed: false });
		await switchLanguage('en', deps);
		expect(deps.locale.set).toHaveBeenCalledExactlyOnceWith('en');
		expect(deps.draftGuard.confirmReloading).toHaveBeenCalledOnce();
		expect(deps.reseed).not.toHaveBeenCalled();
	});

	it("only sets the language when the demo holds an entry of the reader's own", async () => {
		const deps = setup({ logs: [seedLog, userLog] });
		await switchLanguage('en', deps);
		expect(deps.locale.set).toHaveBeenCalledExactlyOnceWith('en');
		expect(deps.draftGuard.confirmReloading).not.toHaveBeenCalled();
		expect(deps.reseed).not.toHaveBeenCalled();
	});

	it('only sets the language when the demo is already written in it', async () => {
		const deps = setup({ marker: 'watson-v1:en' });
		await switchLanguage('en', deps);
		expect(deps.locale.set).toHaveBeenCalledExactlyOnceWith('en');
		expect(deps.repository.listLogs).not.toHaveBeenCalled();
		expect(deps.reseed).not.toHaveBeenCalled();
	});

	it.each([
		['no marker', null],
		['a marker of another manifest', 'demo-v1:ru']
	])('only sets the language when the seed language is unknown (%s)', async (_case, marker) => {
		const deps = setup({ marker });
		await switchLanguage('en', deps);
		expect(deps.locale.set).toHaveBeenCalledExactlyOnceWith('en');
		expect(deps.repository.listLogs).not.toHaveBeenCalled();
		expect(deps.reseed).not.toHaveBeenCalled();
	});

	it('only sets the language outside the demo, without reading the journal', async () => {
		for (const space of ['canonical', 'imported-0f0e0d0c-0b0a-4908-8706-050403020100']) {
			const deps = setup({ space });
			await switchLanguage('en', deps);
			expect(deps.locale.set).toHaveBeenCalledExactlyOnceWith('en');
			expect(deps.repository.listLogs).not.toHaveBeenCalled();
			expect(deps.reseed).not.toHaveBeenCalled();
		}
	});

	it('only sets the language without browser storage', async () => {
		const deps = setup({ storage: null });
		await switchLanguage('en', deps);
		expect(deps.locale.set).toHaveBeenCalledExactlyOnceWith('en');
		expect(deps.reseed).not.toHaveBeenCalled();
	});

	it('ignores a value that is not a language', async () => {
		const deps = setup();
		await switchLanguage('de', deps);
		expect(deps.locale.set).not.toHaveBeenCalled();
		expect(deps.repository.listLogs).not.toHaveBeenCalled();
		expect(deps.reseed).not.toHaveBeenCalled();
	});

	it('hands a refused reseed to the caller, with the language already set', async () => {
		const deps = setup();
		vi.mocked(deps.reseed).mockRejectedValueOnce(new Error('IndexedDB is busy'));
		await expect(switchLanguage('en', deps)).rejects.toThrow('IndexedDB is busy');
		expect(deps.locale.set).toHaveBeenCalledExactlyOnceWith('en');
	});
});
