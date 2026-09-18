import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaState } from './Pwa.svelte';
import { ACTIVATE_UPDATE, CLIENT_VERSION, PERSISTENCE_REQUEST_KEY } from './constants';

afterEach(() => vi.unstubAllGlobals());

const harness = () => {
	const registration = Object.assign(new EventTarget(), {
		waiting: null as (EventTarget & { postMessage: ReturnType<typeof vi.fn> }) | null,
		installing: new EventTarget(),
		update: vi.fn(async () => {})
	});
	const container = Object.assign(new EventTarget(), { controller: { postMessage: vi.fn() } });
	vi.stubGlobal('document', new EventTarget());
	const state = new PwaState();
	const reload = vi.fn();
	const disconnect = state.connect(
		registration as unknown as ServiceWorkerRegistration,
		container as unknown as ServiceWorkerContainer,
		'v1',
		reload
	);
	return { state, registration, container, reload, disconnect };
};

describe('PWA lifecycle', () => {
	it('waits for an explicit update and reloads only the accepting tab', () => {
		const { state, registration, container, reload } = harness();
		registration.waiting = Object.assign(new EventTarget(), { postMessage: vi.fn() });
		registration.installing.dispatchEvent(new Event('statechange'));
		expect(state.available).toBe(true);
		expect(reload).not.toHaveBeenCalled();
		state.apply();
		expect(registration.waiting.postMessage).toHaveBeenCalledWith({ type: ACTIVATE_UPDATE });
		container.dispatchEvent(new Event('controllerchange'));
		expect(reload).toHaveBeenCalledOnce();
	});
	it('keeps another open tab running and reports the version of its loaded code', () => {
		const { state, container, reload, disconnect } = harness();
		container.dispatchEvent(new Event('controllerchange'));
		expect(state.available).toBe(true);
		expect(reload).not.toHaveBeenCalled();
		expect(container.controller.postMessage).toHaveBeenLastCalledWith({
			type: CLIENT_VERSION,
			version: 'v1'
		});
		disconnect();
		state.available = false;
		container.dispatchEvent(new Event('controllerchange'));
		expect(state.available).toBe(false);
	});
	it('reports a failed manual update without discarding the waiting version', async () => {
		const { state, registration } = harness();
		state.available = true;
		registration.update.mockRejectedValueOnce(new Error('offline'));
		await state.check();
		expect(state.available).toBe(true);
		expect(state.checking).toBe(false);
		expect(state.error).toBe('pwa.checkFailed');
	});
	it('does not repeat a denied persistence request on every launch', async () => {
		const state = new PwaState();
		const values = new Map<string, string>();
		const markers = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => {
				values.set(key, value);
			}
		};
		const manager = {
			persist: vi.fn(async () => false),
			persisted: vi.fn(async () => false),
			estimate: vi.fn(async () => ({ usage: 1024 }))
		};
		await state.requestPersistence(manager as unknown as StorageManager, markers);
		await state.requestPersistence(manager as unknown as StorageManager, markers);
		expect(manager.persist).toHaveBeenCalledOnce();
		expect(values.get(PERSISTENCE_REQUEST_KEY)).toBe('1');
		expect(state.storage).toEqual({ usage: 1024, persistent: false });
	});
	it('continues when persistence permissions or storage estimates are unavailable', async () => {
		const state = new PwaState();
		const manager = {
			persist: vi.fn(async () => {
				throw new Error('denied');
			}),
			estimate: vi.fn(async () => {
				throw new Error('unavailable');
			})
		};
		await state.requestPersistence(manager as unknown as StorageManager, {
			getItem: () => null,
			setItem: vi.fn()
		});
		expect(state.storage).toEqual({ usage: null, persistent: null });
	});
});
