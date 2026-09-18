import { CodedError } from '$lib/model/Errors/CodedError';
import { getDeviceId } from './ids';

const AUTH_STORAGE_KEY = 'tempience.triplit.auth';

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

export const getTriplitServerUrl = (): string | undefined => {
	if (import.meta.env.PUBLIC_BUILD === '1') return undefined;
	const value = import.meta.env.PUBLIC_TRIPLIT_SERVER_URL as string | undefined;
	const normalized = value?.trim().replace(/\/$/, '');
	return normalized || undefined;
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

export const pairDevice = async (
	code: string,
	deviceLabel = 'Browser device'
): Promise<DeviceAuth> => {
	const serverUrl = getTriplitServerUrl();
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
	saveAuth(auth);
	return auth;
};
