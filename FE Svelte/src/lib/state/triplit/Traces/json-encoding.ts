/**
 * Storage codec for the two replaceable JSON fields of a Trace.
 *
 * Triplit deep-merges JSON objects on every write path, including the query-view diffs
 * that replicas receive, so a rewritten object can never drop keys. Arrays are assigned
 * whole. A rewritten field is therefore stored as a singleton array `[value]`, and the
 * optional `encoding` map on the row records which fields use that shape:
 *
 *   encoding.<field> === 1  <=>  stored <field> is [domainValue] (object or null)
 *   encoding.<field> absent <=>  legacy stored shape, untouched
 *
 * A marker is permanent for its field once written; the map only ever gains keys, so
 * saving one field can never disturb the other. Rows are never rewritten proactively.
 */
import type { JsonObject } from '../types';

export const TRACE_FIELD_ENCODING = 1;

export const ENCODED_TRACE_FIELDS = ['aboutTime', 'data'] as const;

export type EncodedTraceField = (typeof ENCODED_TRACE_FIELDS)[number];

export type TraceFieldEncoding = Partial<Record<EncodedTraceField, typeof TRACE_FIELD_ENCODING>>;

export type StoredTraceField = { encoded: boolean; value: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);

const isEncodedTraceField = (value: unknown): value is EncodedTraceField =>
	ENCODED_TRACE_FIELDS.includes(value as EncodedTraceField);

/** Strict shape of the marker map; unknown fields or versions are corruption, not leniency. */
export const parseTraceEncoding = (
	value: unknown,
	label = 'Trace encoding'
): TraceFieldEncoding => {
	if (value === undefined || value === null) return {};
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	const encoding: TraceFieldEncoding = {};
	for (const [field, version] of Object.entries(value)) {
		if (!isEncodedTraceField(field)) throw new Error(`${label} has an unsupported field: ${field}`);
		if (version !== TRACE_FIELD_ENCODING) {
			throw new Error(`${label}.${field} has an unsupported version: ${String(version)}`);
		}
		encoding[field] = TRACE_FIELD_ENCODING;
	}
	return encoding;
};

/** The stored patch for a rewritten field: the value in its atomic shape plus its marker. */
export const encodedTraceFieldPatch = (
	field: EncodedTraceField,
	value: JsonObject | null,
	encoding: TraceFieldEncoding = {}
): { [key: string]: unknown; encoding: TraceFieldEncoding } => ({
	[field]: [value],
	encoding: { ...encoding, [field]: TRACE_FIELD_ENCODING }
});

/**
 * Reads a field from a full row. An encoded field must be exactly `[value]`; anything else
 * under a marker is corruption. Without a marker the legacy value is returned as stored.
 */
export const readStoredTraceField = (
	row: Record<string, unknown>,
	field: EncodedTraceField
): StoredTraceField => {
	const encoding = parseTraceEncoding(row.encoding, `Trace ${String(row.id)} encoding`);
	const stored = row[field];
	if (encoding[field] === undefined) return { encoded: false, value: stored };
	if (!Array.isArray(stored) || stored.length !== 1) {
		throw new Error(`Trace ${String(row.id)} ${field} must be a singleton array when encoded`);
	}
	return { encoded: true, value: stored[0] };
};

/**
 * Selected reads (`Select(['data.0.x'])`) return an encoded field as an object keyed by "0",
 * while full reads return the array. Both shapes decode here; a legacy row keeps its object
 * even when it has its own "0" key, because the marker decides.
 */
export const readSelectedTraceField = (
	row: Record<string, unknown>,
	field: EncodedTraceField
): unknown => {
	const encoding = parseTraceEncoding(row.encoding, `Trace ${String(row.id)} encoding`);
	const stored = row[field];
	if (encoding[field] === undefined) return stored;
	if (Array.isArray(stored)) {
		if (stored.length !== 1) {
			throw new Error(`Trace ${String(row.id)} ${field} must be a singleton array when encoded`);
		}
		return stored[0];
	}
	if (isRecord(stored)) return stored['0'];
	if (stored === undefined) return undefined;
	throw new Error(`Trace ${String(row.id)} ${field} has an unsupported encoded shape`);
};
