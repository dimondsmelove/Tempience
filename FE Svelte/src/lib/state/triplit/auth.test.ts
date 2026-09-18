import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearStoredAuth,
	forgetServerUrl,
	getStoredAuth,
	getTriplitServerUrl,
	isServerUrlEditable,
	pairDevice,
	parseServerUrl,
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

describe('user-entered sync server (public build)', () => {
	const okResponse = (): Response =>
		new Response(
			JSON.stringify({
				deviceId: 'device-123',
				deviceLabel: 'Phone',
				token: 'jwt-for-device',
				expiresAt: new Date(Date.now() + 60_000).toISOString()
			}),
			{ status: 200, headers: { 'content-type': 'application/json' } }
		);

	beforeEach(() => {
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: createStorage()
		});
		vi.stubEnv('PUBLIC_BUILD', '1');
		vi.stubEnv('PUBLIC_TRIPLIT_SERVER_URL', '');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it('is editable only without a build-time address', () => {
		expect(isServerUrlEditable()).toBe(true);
		vi.stubEnv('PUBLIC_BUILD', '');
		vi.stubEnv('PUBLIC_TRIPLIT_SERVER_URL', 'https://sync.example.test:8449');
		expect(isServerUrlEditable()).toBe(false);
	});

	it('pairs against the entered address and remembers it', async () => {
		const fetch = vi.fn().mockResolvedValue(okResponse());
		vi.stubGlobal('fetch', fetch);

		await pairDevice('pairing-code', 'Phone', 'https://laptop.tail1234.ts.net/');

		expect(fetch).toHaveBeenCalledWith(
			'https://laptop.tail1234.ts.net/pair',
			expect.objectContaining({ method: 'POST' })
		);
		expect(getTriplitServerUrl()).toBe('https://laptop.tail1234.ts.net');
		expect(getStoredAuth()?.token).toBe('jwt-for-device');
	});

	it('does not remember an address the server refused', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_code' }), { status: 403 }))
		);
		await expect(pairDevice('wrong', 'Phone', 'https://laptop.tail1234.ts.net')).rejects.toThrow(
			/invalid_code/
		);
		expect(getTriplitServerUrl()).toBeUndefined();
	});

	it('requires https except for the developer machine', () => {
		expect(() => parseServerUrl('http://192.168.1.5:6544')).toThrow(/https/);
		expect(parseServerUrl('http://127.0.0.1:6544')).toBe('http://127.0.0.1:6544');
		expect(parseServerUrl('http://localhost:6544/')).toBe('http://localhost:6544');
	});

	it('rejects anything that is not a plain URL', () => {
		expect(() => parseServerUrl('laptop.tail1234.ts.net')).toThrow(/URL/);
		expect(() => parseServerUrl('https://user:pw@laptop.tail1234.ts.net')).toThrow(/URL/);
		expect(() => parseServerUrl('https://laptop.tail1234.ts.net/?x=1')).toThrow(/URL/);
	});

	it('forgets the address on request', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
		await pairDevice('pairing-code', 'Phone', 'https://laptop.tail1234.ts.net');
		forgetServerUrl();
		expect(getTriplitServerUrl()).toBeUndefined();
	});

	it('never stores the address in an owner build', async () => {
		vi.stubEnv('PUBLIC_BUILD', '');
		vi.stubEnv('PUBLIC_TRIPLIT_SERVER_URL', 'https://sync.example.test:8449');
		const fetch = vi.fn().mockResolvedValue(okResponse());
		vi.stubGlobal('fetch', fetch);

		await pairDevice('pairing-code', 'Phone', 'https://elsewhere.example');

		expect(fetch).toHaveBeenCalledWith('https://sync.example.test:8449/pair', expect.anything());
		expect(localStorage.getItem('tempience.triplit.server')).toBeNull();
	});
});
