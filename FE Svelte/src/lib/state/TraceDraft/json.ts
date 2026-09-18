import type { JsonObject, JsonValue } from '$lib/state/triplit/types';

/**
 * The typed values as JSON, read at the validation and save boundaries. SJSF keeps a cleared
 * or unparsable control as `undefined` inside the bound object; JSON has no such value. An
 * `undefined` property is an omitted optional field, a legal document. An `undefined` array
 * item has no JSON meaning and would turn into `null` on the way out, so the input is
 * reported as incomplete instead of being changed silently. Explicit null, false, zero and
 * empty strings are values and stay.
 */
export type JsonReading = { ok: true; value: JsonObject } | { ok: false; path: string };

const readValue = (raw: unknown, path: string): { value: JsonValue } | { path: string } => {
	if (raw === undefined) return { path };
	if (raw === null || typeof raw !== 'object') return { value: raw as JsonValue };
	if (Array.isArray(raw)) {
		const items: JsonValue[] = [];
		for (const [index, item] of raw.entries()) {
			const read = readValue(item, `${path}/${index}`);
			if ('path' in read) return read;
			items.push(read.value);
		}
		return { value: items };
	}
	// Own data properties only, whatever their names: `__proto__` is a legal JSON key too.
	const entries: [string, JsonValue][] = [];
	for (const [key, item] of Object.entries(raw as Record<string, unknown>)) {
		if (item === undefined) continue;
		const read = readValue(item, `${path}/${key}`);
		if ('path' in read) return read;
		entries.push([key, read.value]);
	}
	return { value: Object.fromEntries(entries) };
};

export const jsonData = (raw: unknown): JsonReading => {
	const read = readValue(raw ?? {}, '');
	if ('path' in read) return { ok: false, path: read.path };
	const value = read.value;
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? { ok: true, value }
		: { ok: false, path: '' };
};

/** One serialization for equality: object keys sorted, array order kept, incompleteness kept apart. */
export const canonicalData = (raw: unknown): string => {
	const read = jsonData(raw);
	if (!read.ok) return `incomplete:${read.path}:${JSON.stringify(raw ?? null)}`;
	return JSON.stringify(read.value, (_key, entry: unknown) =>
		entry !== null && typeof entry === 'object' && !Array.isArray(entry)
			? Object.fromEntries(
					Object.entries(entry as Record<string, unknown>).toSorted(([a], [b]) => (a < b ? -1 : 1))
				)
			: entry
	);
};

/** The same JSON, whatever order SJSF or the repository handed the keys in. */
export const sameData = (left: unknown, right: unknown): boolean =>
	canonicalData(left) === canonicalData(right);
