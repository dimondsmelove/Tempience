import type { Entity } from '../Repository/types';

/**
 * Fields of a Trace whose last write is stamped with its operation id in the optional
 * `traces.revisions` map: `{ field: operationId }`. Each field carries its own revision, so
 * an inverse can verify that the field it compensates still belongs to the offered action
 * while independent fields, memberships and links stay untouched. `isDeleted` is the
 * record's lifecycle revision. Rows written by older builds carry no stamps: an inverse of
 * their operations is refused rather than guessed.
 */
export const TRACE_REVISION_FIELDS = [
	'content',
	'description',
	'capturedAt',
	'timezone',
	'aboutKind',
	'aboutTime',
	'statedDuration',
	'aboutTraceId',
	'relation',
	'data',
	'isDeleted'
] as const;

export type TraceRevisionField = (typeof TRACE_REVISION_FIELDS)[number];

export type TraceRevisions = Partial<Record<TraceRevisionField, string>>;

const isRevisionField = (field: string): field is TraceRevisionField =>
	(TRACE_REVISION_FIELDS as readonly string[]).includes(field);

/** The stamps a write leaves for the fields it changed; unknown and derived fields are skipped. */
export const traceRevisionStamps = (
	fields: readonly string[],
	operationId: string
): TraceRevisions =>
	Object.fromEntries(fields.filter(isRevisionField).map((field) => [field, operationId]));

/** Stored stamps of a row as read; a missing or malformed map reads as no stamps. */
export const traceRevisions = (row: Pick<Entity, 'revisions'> | Entity): TraceRevisions => {
	const raw = row.revisions;
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const stamps: TraceRevisions = {};
	for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
		if (isRevisionField(field) && typeof value === 'string') stamps[field] = value;
	}
	return stamps;
};
