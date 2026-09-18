import { CodedError } from '$lib/model/Errors/CodedError';
import { getDeviceId } from './ids';

const AUTH_STORAGE_KEY = 'tempience.triplit.auth';
/** The sync server this browser was pointed at on /pair; only when no build-time address exists. */
const SERVER_STORAGE_KEY = 'tempience.triplit.server';
/** Hosts a plain http:// address may point at: the developer's own machine. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export type DeviceAuth = {
	deviceId: string;
	deviceLabel: string;
	token: string;
	expiresAt: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

const storage = (): Storage | null => {
	if (typeof localStorage === 'undefined') return null;
	try {
		return localStorage;
	} catch {
		return null;
	}
};

/** The owner's build-time address; a public build never carries one. */
const configuredServerUrl = (): string | undefined => {
	if (import.meta.env.PUBLIC_BUILD === '1') return undefined;
	const value = import.meta.env.PUBLIC_TRIPLIT_SERVER_URL as string | undefined;
	const normalized = value?.trim().replace(/\/$/, '');
	return normalized || undefined;
};

const storedServerUrl = (): string | undefined => {
	try {
		return storage()?.getItem(SERVER_STORAGE_KEY) ?? undefined;
	} catch {
		return undefined;
	}
};

export const getTriplitServerUrl = (): string | undefined =>
	configuredServerUrl() ?? storedServerUrl();

/** True when the address comes from the user, not the build: /pair shows the address field. */
export const isServerUrlEditable = (): boolean => configuredServerUrl() === undefined;

/**
 * Normalizes a user-entered sync server address. The app is served over HTTPS, so the browser
 * would refuse a plain http:// server anyway — except on the developer's own machine.
 */
export const parseServerUrl = (value: string): string => {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		throw new CodedError('pairing_server_invalid', 'Адрес сервера должен быть полным URL.');
	}
	const secure =
		url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
	if (!secure)
		throw new CodedError('pairing_server_insecure', 'Адрес сервера должен начинаться с https://.');
	if (url.username || url.password || url.search || url.hash)
		throw new CodedError('pairing_server_invalid', 'Адрес сервера должен быть полным URL.');
	return `${url.origin}${url.pathname}`.replace(/\/$/, '');
};

export const forgetServerUrl = (): void => {
	storage()?.removeItem(SERVER_STORAGE_KEY);
};

const isUnexpired = (expiresAt: string): boolean => {
	const timestamp = Date.parse(expiresAt);
	return Number.isFinite(timestamp) && timestamp > Date.now();
};

const parseDeviceAuth = (value: unknown): DeviceAuth | null => {
	if (!isRecord(value)) return null;
	if (
		typeof value.deviceId !== 'string' ||
		typeof value.deviceLabel !== 'string' ||
		typeof value.token !== 'string' ||
		typeof value.expiresAt !== 'string' ||
		!isUnexpired(value.expiresAt)
	) {
		return null;
	}
	return {
		deviceId: value.deviceId,
		deviceLabel: value.deviceLabel,
		token: value.token,
		expiresAt: value.expiresAt
	};
};

export const getStoredAuth = (): DeviceAuth | null => {
	const target = storage();
	if (!target) return null;
	try {
		const raw = target.getItem(AUTH_STORAGE_KEY);
		if (!raw) return null;
		const parsed = parseDeviceAuth(JSON.parse(raw) as unknown);
		if (!parsed) target.removeItem(AUTH_STORAGE_KEY);
		return parsed;
	} catch {
		return null;
	}
};

export const getStoredToken = (): string | undefined => getStoredAuth()?.token;

export const clearStoredAuth = (): void => {
	storage()?.removeItem(AUTH_STORAGE_KEY);
};

const saveAuth = (auth: DeviceAuth): void => {
	storage()?.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
};

/**
 * Pairs this browser with a sync server. With a build-time address the server is fixed; otherwise
 * the address entered on /pair is used and remembered together with the device token.
 */
export const pairDevice = async (
	code: string,
	deviceLabel = 'Browser device',
	serverInput?: string
): Promise<DeviceAuth> => {
	const editable = isServerUrlEditable();
	const serverUrl = editable && serverInput ? parseServerUrl(serverInput) : getTriplitServerUrl();
	if (!serverUrl)
		throw new CodedError('pairing_server_url', 'PUBLIC_TRIPLIT_SERVER_URL не настроен.');
	if (code.trim().length === 0)
		throw new CodedError('pairing_code_required', 'Введите pairing-код.');

	const response = await fetch(`${serverUrl}/pair`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			code: code.trim(),
			deviceId: getDeviceId(),
			deviceLabel: deviceLabel.trim() || 'Browser device'
		})
	});
	let body: unknown;
	try {
		body = (await response.json()) as unknown;
	} catch {
		body = null;
	}
	if (!response.ok) {
		const detail = isRecord(body) && typeof body.error === 'string' ? body.error : 'unknown_error';
		throw new CodedError('pairing_failed', `Pairing не удался: ${detail}`, { detail });
	}
	const auth = parseDeviceAuth(body);
	if (!auth) throw new CodedError('pairing_token', 'Сервер вернул некорректный device token.');
	if (editable) storage()?.setItem(SERVER_STORAGE_KEY, serverUrl);
	saveAuth(auth);
	return auth;
};
