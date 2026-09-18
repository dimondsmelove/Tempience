const toHex = (byte: number): string => byte.toString(16).padStart(2, '0');

export const createId = (): string => {
	const cryptoApi = globalThis.crypto;
	if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
	if (typeof cryptoApi?.getRandomValues !== 'function') {
		throw new Error('Secure random UUID generation is unavailable in this environment');
	}

	// Tailnet development over HTTP is not a secure context, so randomUUID may be absent.
	const bytes = new Uint8Array(16);
	cryptoApi.getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, toHex);
	return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
};

const DEVICE_ID_KEY = 'tempience.device-id';

export const getDeviceId = (): string => {
	if (typeof localStorage === 'undefined') return 'unknown-device';
	try {
		const existing = localStorage.getItem(DEVICE_ID_KEY);
		if (existing) return existing;
		const created = createId();
		localStorage.setItem(DEVICE_ID_KEY, created);
		return created;
	} catch {
		return 'unknown-device';
	}
};
