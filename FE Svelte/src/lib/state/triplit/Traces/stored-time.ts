import { assertJsonObject } from '../trace-kind-v-validation';
import {
	assertCalendarValue,
	normalizeStoredTraceAboutTime,
	parseTraceAboutTime,
	relativePrecisions,
	relativeRelations,
	temporalCertainties,
	temporalPrecisions,
	type TraceExactTimeProjection
} from '../trace-time';
import type { JsonObject, TraceAboutKind, TraceAboutTime } from '../types';
import { parseTraceEncoding, readSelectedTraceField, readStoredTraceField } from './json-encoding';

const VARIANT_KEYS = new Map<string, readonly string[]>([
	['absolute', ['precision', 'certainty', 'start', 'end']],
	['relative', ['precision', 'anchorTraceId', 'relation']],
	['unknown', []]
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

const isEnum = (values: readonly string[], value: unknown): boolean =>
	typeof value === 'string' && values.includes(value);

/** A calendar value of any accepted precision, since the precision it was paired with may be gone. */
const isCalendarValue = (value: unknown): boolean =>
	typeof value === 'string' &&
	temporalPrecisions.some((precision) => {
		try {
			assertCalendarValue(value, precision, 'Stored aboutTime residue');
			return true;
		} catch {
			return false;
		}
	});

/**
 * What a leftover key may hold if it came from an earlier valid variant. Each key is judged
 * on its own: repeated valid changes can leave residue from different eras side by side.
 */
const PLAUSIBLE_RESIDUE: Record<string, (value: unknown) => boolean> = {
	precision: (value) => isEnum(relativePrecisions, value),
	certainty: (value) => isEnum(temporalCertainties, value),
	start: isCalendarValue,
	end: isCalendarValue,
	anchorTraceId: (value) =>
		typeof value === 'string' && value.trim().length > 0 && value === value.trim(),
	relation: (value) => isEnum(relativeRelations, value)
};

/**
 * Stored-only compatibility for legacy rows: before the atomic encoding, changing the
 * basis deep-merged the new variant over the old one, leaving the other variant's keys
 * behind. A leftover key is dropped only when it is a null tombstone or a value that an
 * accepted variant could have held; anything else, like any unknown key, stays in the
 * object so the strict parser refuses it with a useful error. Values are never rewritten.
 */
export const projectStoredAboutTime = (value: unknown): unknown => {
	if (!isRecord(value) || typeof value.basis !== 'string') return value;
	const variant = VARIANT_KEYS.get(value.basis);
	if (!variant) return value;
	// Own keys are copied as own keys: an assignment would hand an own "__proto__" from JSON
	// to the prototype setter and hide it from the strict parser.
	return Object.fromEntries(
		Object.entries(value).filter(([key, entry]) => {
			const leftover =
				key !== 'basis' && !variant.includes(key) && Object.hasOwn(PLAUSIBLE_RESIDUE, key);
			return !(leftover && (entry === null || PLAUSIBLE_RESIDUE[key](entry)));
		})
	);
};

/** The current aboutTime of a stored row: encoded values are exact, legacy values are projected. */
export const readStoredTraceTime = (
	row: Record<string, unknown>,
	aboutKind: TraceAboutKind,
	legacy: TraceExactTimeProjection
): TraceAboutTime | null => {
	const stored = readStoredTraceField(row, 'aboutTime');
	if (stored.encoded) {
		return stored.value === null ? null : parseTraceAboutTime(stored.value);
	}
	return normalizeStoredTraceAboutTime(projectStoredAboutTime(stored.value), aboutKind, legacy);
};

/** How a row was read: whole, or through a selection that names some of its data paths. */
export type StoredRowShape = 'stored' | 'selected';

/** Whether a value holds anything at any leaf: an object of nothing but empty objects does not. */
const holdsValue = (entry: unknown): boolean =>
	!isRecord(entry) || Object.values(entry).some(holdsValue);

/**
 * What a selection answers where a named path has no value: `undefined` holes, which are not
 * data, and — on a legacy row, whose data is stored plain — a "0" object left by the
 * selection of the encoded shape, holding nothing at any leaf, which is not a field either.
 * Both are dropped.
 */
const selectedData = (value: unknown, encoded: boolean): unknown => {
	const clean = (entry: unknown): unknown => {
		if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return entry;
		const kept: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(entry as Record<string, unknown>)) {
			if (item === undefined) continue;
			kept[key] = clean(item);
		}
		return kept;
	};
	const cleaned = clean(value);
	if (!encoded && isRecord(cleaned) && isRecord(cleaned['0']) && !holdsValue(cleaned['0'])) {
		delete cleaned['0'];
	}
	return cleaned;
};

/**
 * The current typed data of a stored row; both shapes must hold an object or null. A selected
 * read carries only the paths it named, in the shape a selection returns them in.
 */
export const readStoredTraceData = (
	row: Record<string, unknown>,
	shape: StoredRowShape = 'stored'
): JsonObject | null => {
	const value =
		shape === 'selected'
			? selectedData(
					readSelectedTraceField(row, 'data'),
					parseTraceEncoding(row.encoding).data !== undefined
				)
			: readStoredTraceField(row, 'data').value;
	if (value === null || value === undefined) return null;
	assertJsonObject(value, 'Stored Trace data');
	return value;
};
