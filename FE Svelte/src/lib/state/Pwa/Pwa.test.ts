import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaState } from './Pwa.svelte';
import { CLIENT_VERSION, PERSISTENCE_REQUEST_KEY, WORKER_VERSION } from './constants';

afterEach(() => vi.unstubAllGlobals());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const controller = () => ({ postMessage: vi.fn() });

const harness = () => {
	const registration = Object.assign(new EventTarget(), {
		waiting: null as object | null,
		installing: null as object | null,
		update: vi.fn(async () => {})
	});
	const container = Object.assign(new EventTarget(), { controller: controller() });
	vi.stubGlobal('document', new EventTarget());
	const state = new PwaState();
	const reload = vi.fn();
	const disconnect = state.connect(
		registration as unknown as ServiceWorkerRegistration,
		container as unknown as ServiceWorkerContainer,
		'v1',
		reload
	);
	/** The controlling worker answers with the build it serves. */
	const answer = (version: string) =>
		container.dispatchEvent(
			new MessageEvent('message', { data: { type: WORKER_VERSION, version } })
		);
	return { state, registration, container, reload, disconnect, answer };
};

describe('PWA update prompt', () => {
	it('reports its build to the controlling worker and stays quiet when the worker serves it too', async () => {
		const { state, registration, container, answer } = harness();
		expect(container.controller.postMessage).toHaveBeenCalledWith({
			type: CLIENT_VERSION,
			version: 'v1'
		});
		answer('v1');
		await flush();
		expect(state.available).toBe(false);
		expect(registration.update).not.toHaveBeenCalled();
	});
	it('offers the reload when the worker serves another build and the server has nothing newer', async () => {
		const { state, registration, reload, answer } = harness();
		state.notice = 'pwa.checked';
		answer('v2');
		await vi.waitFor(() => expect(state.available).toBe(true));
		expect(state.notice).toBeNull();
		expect(registration.update).toHaveBeenCalledOnce();
		expect(reload).not.toHaveBeenCalled();
		state.apply();
		expect(reload).toHaveBeenCalledOnce();
	});
	it('waits for a newer worker that is installing instead of offering a reload to a current page', async () => {
		const { state, registration, container, answer } = harness();
		registration.update.mockImplementationOnce(async () => {
			registration.installing = {};
		});
		answer('v0');
		await flush();
		expect(state.available).toBe(false);
		// The newer worker took over and is asked again; it serves this page's build.
		registration.installing = null;
		container.controller = controller();
		container.dispatchEvent(new Event('controllerchange'));
		expect(container.controller.postMessage).toHaveBeenCalledWith({
			type: CLIENT_VERSION,
			version: 'v1'
		});
		answer('v1');
		await flush();
		expect(state.available).toBe(false);
	});
	it('asks the new controller after a takeover and offers the reload only for a different build', async () => {
		const { state, container, answer } = harness();
		container.dispatchEvent(new Event('controllerchange'));
		answer('v1');
		await flush();
		expect(state.available).toBe(false);
		container.dispatchEvent(new Event('controllerchange'));
		answer('v2');
		await vi.waitFor(() => expect(state.available).toBe(true));
	});
	it('leaves a page alone whose mismatch cannot be settled with the server', async () => {
		const { state, registration, answer } = harness();
		registration.update.mockRejectedValueOnce(new Error('offline'));
		answer('v2');
		await flush();
		expect(state.available).toBe(false);
	});
	it('says that a manual check found nothing when no other build was reported', async () => {
		const { state, registration } = harness();
		await state.check();
		expect(registration.update).toHaveBeenCalledOnce();
		expect(state.notice).toBe('pwa.checked');
		expect(state.available).toBe(false);
	});
	it('does not read a waiting worker as an update', () => {
		const { state, registration } = harness();
		registration.waiting = {};
		registration.dispatchEvent(new Event('updatefound'));
		expect(state.available).toBe(false);
		state.apply();
		expect(state.available).toBe(false);
	});
	it('stops listening once disconnected', async () => {
		const { state, container, disconnect, answer } = harness();
		disconnect();
		container.controller.postMessage.mockClear();
		container.dispatchEvent(new Event('controllerchange'));
		expect(container.controller.postMessage).not.toHaveBeenCalled();
		answer('v2');
		await flush();
		expect(state.available).toBe(false);
		expect(state.registration).toBeNull();
	});
	it('reports a failed manual update without discarding an offered one', async () => {
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
