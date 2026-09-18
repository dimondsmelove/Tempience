import type { EntityType, Log, LogAction, LogActor, LogCause } from '$lib/state/triplit/types';

/** One field the operation changed, as the journal recorded it. */
export type HistoryChange = Readonly<{ field: string; before: unknown; after: unknown }>;

/** What one operation did to one record, link or statement. */
export type HistoryItem = Readonly<{
	entityType: EntityType;
	entityId: string;
	action: LogAction;
	/** Empty for a creation, whose journal entry is the whole row rather than a difference. */
	changes: readonly HistoryChange[];
}>;

/** One operation of the journal, with everything it did to this record, in one place. */
export type HistoryOperation = Readonly<{
	operationId: string;
	occurredAt: string;
	cause: LogCause;
	actor: LogActor;
	items: readonly HistoryItem[];
}>;

/**
 * Fields the record does not hold itself: projections of its own time, the revision stamps the
 * guards read, and the stored shapes a statement is merged from. They are consequences of what
 * the user did, not what they did — a restated value takes a new revision and the journal keeps
 * it, but «оценка · изменено» with an operation id for a value is not a history anyone reads.
 */
const DERIVED = new Set([
	'aboutAt',
	'aboutStart',
	'aboutEnd',
	'revisions',
	'updatedAt',
	'createdAt',
	'lifecycleId',
	'outcomeRevision',
	'openRevision',
	'placementRevision',
	'initial',
	'values',
	'placement',
	'origin'
]);

const isChange = (value: unknown): value is { before: unknown; after: unknown } =>
	value !== null && typeof value === 'object' && 'before' in value && 'after' in value;

/** Fields whose stored value is the id of a record: shown by the name that record has. */
export const NAMED_FIELDS: ReadonlySet<string> = new Set([
	'intentionId',
	'originIntentionId',
	'factId',
	'aboutTraceId'
]);

/**
 * The records a journal's own values name: what a named field held before and after — the
 * intention a statement was moved from or to, which the record's answer need not contain.
 */
export const namedRecordIds = (logs: readonly Log[]): string[] => {
	const ids = new Set<string>();
	// A row without a patch names nothing; the reader must never fail on the journal's shape.
	for (const log of logs)
		for (const [field, value] of Object.entries(log.patch ?? {})) {
			if (!NAMED_FIELDS.has(field) || !isChange(value)) continue;
			for (const id of [value.before, value.after]) if (typeof id === 'string' && id) ids.add(id);
		}
	return [...ids].toSorted();
};

const changesOf = (log: Log): HistoryChange[] => {
	const changes: HistoryChange[] = [];
	for (const [field, value] of Object.entries(log.patch)) {
		if (DERIVED.has(field) || field === 'snapshot' || !isChange(value)) continue;
		changes.push({ field, before: value.before, after: value.after });
	}
	return changes;
};

/**
 * The journal of one record as its Context reads it: one entry per operation, newest first,
 * holding everything that operation did — the record's own fields, the links it made or
 * withdrew and the statements it wrote. Nothing is derived or recomputed here; this is what
 * the journal says, grouped so that one action reads as one action.
 */
export const historyOperations = (logs: readonly Log[]): HistoryOperation[] => {
	const byOperation = new Map<string, { log: Log; items: HistoryItem[] }>();
	for (const log of logs) {
		const entry = byOperation.get(log.operationId) ?? { log, items: [] };
		// The earliest entry of an operation carries the moment the whole operation happened.
		if (log.occurredAt < entry.log.occurredAt) entry.log = log;
		entry.items.push({
			entityType: log.entityType,
			entityId: log.entityId,
			action: log.action,
			changes: changesOf(log)
		});
		byOperation.set(log.operationId, entry);
	}
	return [...byOperation.entries()]
		.map(([operationId, entry]) => ({
			operationId,
			occurredAt: entry.log.occurredAt,
			cause: entry.log.cause,
			actor: entry.log.actor,
			items: entry.items
		}))
		.toSorted(
			(left, right) =>
				right.occurredAt.localeCompare(left.occurredAt) ||
				right.operationId.localeCompare(left.operationId)
		);
};

export type { EntityType, LogAction, LogActor, LogCause };
