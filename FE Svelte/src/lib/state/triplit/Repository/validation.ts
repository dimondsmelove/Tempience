import { assertIsoTimestamp } from '../trace-time';

export const enumValue = <Value extends string>(
	value: unknown,
	allowed: readonly Value[],
	label: string
): Value => {
	if (typeof value !== 'string' || !allowed.includes(value as Value)) {
		throw new Error(`${label} is invalid`);
	}
	return value as Value;
};

export const requiredText = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${label} is required`);
	}
	return value.trim();
};

export const nullableText = (value: unknown, label: string): string | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') throw new Error(`${label} must be a string or null`);
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
};

export const nullableIsoTimestamp = (value: unknown, label: string): string | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') throw new Error(`${label} must be an ISO timestamp or null`);
	assertIsoTimestamp(value, label);
	return value;
};

export const entityId = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
		throw new Error(`${label} must be a non-empty trimmed string`);
	}
	return value;
};
