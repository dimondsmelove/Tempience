import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearStoredAuth,
	getStoredAuth,
	getTriplitServerUrl,
	pairDevice,
	type DeviceAuth
} from './auth';

const createStorage = (): Storage => {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key),
		clear: () => values.clear(),
		key: (index) => [...values.keys()][index] ?? null,
		get length() {
			return values.size;
		}
	};
};

describe('Triplit device auth', () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: createStorage()
		});
		vi.stubEnv('PUBLIC_TRIPLIT_SERVER_URL', 'https://sync.example.test:8449');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it('keeps a public build local even if the owner sync URL is present', async () => {
		vi.stubEnv('PUBLIC_BUILD', '1');
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		expect(getTriplitServerUrl()).toBeUndefined();
		await expect(pairDevice('code', 'Phone')).rejects.toThrow();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('stores a device token returned by pairing', async () => {
		const auth: DeviceAuth = {
			deviceId: 'device-123',
			deviceLabel: 'Phone',
			token: 'jwt-for-device',
			expiresAt: new Date(Date.now() + 60_000).toISOString()
		};
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify(auth), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				})
			)
		);

		const paired = await pairDevice('pairing-code', 'Phone');

		expect(paired).toEqual(auth);
		expect(getStoredAuth()).toEqual(auth);
		expect(fetch).toHaveBeenCalledWith(
			'https://sync.example.test:8449/pair',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('clears expired auth instead of starting a stale session', () => {
		localStorage.setItem(
			'tempience.triplit.auth',
			JSON.stringify({
				deviceId: 'expired-device',
				deviceLabel: 'Old phone',
				token: 'expired-token',
				expiresAt: new Date(Date.now() - 60_000).toISOString()
			})
		);

		expect(getStoredAuth()).toBeNull();
		expect(localStorage.getItem('tempience.triplit.auth')).toBeNull();
		clearStoredAuth();
	});
});
