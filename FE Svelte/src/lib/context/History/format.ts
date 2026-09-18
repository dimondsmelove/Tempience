import { locale } from '$lib/state/Locale/Locale.svelte';
import type { MessageKey } from '$lib/state/Locale/types';
import { NAMED_FIELDS, type HistoryChange, type HistoryItem } from '$lib/model/History/history';
import { RELATIONS, relationLabel } from '$lib/context/labels';
import { traceTimeLabel } from '$lib/model/Projection/marks';
import type { EntityType, LogAction, LogCause, TraceRelation } from '$lib/state/triplit/types';

/** The record's own fields, in the words the form uses for them. */
const FIELD_KEYS: Record<string, MessageKey> = {
	content: 'draft.title',
	description: 'draft.description',
	relation: 'draft.relation',
	aboutTime: 'history.time',
	aboutKind: 'history.time',
	statedDuration: 'history.duration',
	aboutTraceId: 'history.anchor',
	data: 'draft.typedFields',
	capturedAt: 'history.captured',
	timezone: 'history.timezone',
	isDeleted: 'history.presence',
	outcome: 'result.outcome',
	open: 'result.openness',
	intentionId: 'history.address'
};

export const fieldKey = (field: string): MessageKey | null => FIELD_KEYS[field] ?? null;

/**
 * Identities of the same move, told again: a correction of a statement's address withdraws one
 * link, activates another and rebinds the statement. The address says what happened; the link
 * and activation ids say it again in identifiers no one entered and no one can read.
 */
const IDENTITIES = new Set(['evidenceId', 'activationId']);

/** What kind of thing an entry is about, so a row says what it touched. */
export const SUBJECT_KEYS: Record<EntityType, MessageKey> = {
	trace: 'history.subjectTrace',
	intersection: 'history.subjectLink',
	intentionAssessment: 'history.subjectAssessment',
	scope: 'history.subjectScope',
	scopeSegment: 'history.subjectScope',
	period: 'history.subjectPeriod',
	traceKind: 'history.subjectKind',
	traceKindV: 'history.subjectKind',
	source: 'history.subjectOther',
	assertion: 'history.subjectOther',
	citation: 'history.subjectOther',
	assertionRelation: 'history.subjectOther',
	provenanceLink: 'history.subjectOther'
};

export const ACTION_KEYS: Record<LogAction, MessageKey> = {
	created: 'history.actionCreated',
	updated: 'history.actionUpdated',
	deleted: 'history.actionDeleted',
	restored: 'history.actionRestored',
	linked: 'history.actionLinked',
	unlinked: 'history.actionUnlinked'
};

export const CAUSE_KEYS: Record<LogCause, MessageKey> = {
	normal: 'history.causeNormal',
	undo: 'history.causeUndo',
	restore: 'history.causeRestore',
	import: 'history.causeImport'
};

const relationText = (value: unknown): string | null =>
	typeof value === 'string' && RELATIONS.includes(value as TraceRelation)
		? relationLabel(value as TraceRelation)
		: null;

/**
 * One stored value as a line of text. Text stays exactly as it was written so it can be read
 * and copied; a time reads as the record shows it; anything else keeps its stored shape rather
 * than being invented into prose.
 */
export const valueText = (
	field: string,
	value: unknown,
	names?: ReadonlyMap<string, string>
): string | null => {
	if (value === null || value === undefined) return null;
	if (field === 'relation') return relationText(value) ?? String(value);
	// An id the Context can name is shown by that name; one it cannot stays as it is stored.
	if (NAMED_FIELDS.has(field) && typeof value === 'string') return names?.get(value) ?? value;
	if (field === 'aboutTime' || field === 'aboutKind' || field === 'statedDuration') {
		const time = { aboutKind: 'instant', aboutTime: null, statedDuration: null } as Parameters<
			typeof traceTimeLabel
		>[0];
		if (field === 'aboutTime')
			return traceTimeLabel({ ...time, aboutTime: value as never }, locale.current);
		if (field === 'statedDuration')
			return traceTimeLabel({ ...time, statedDuration: value as never }, locale.current);
		return String(value);
	}
	if (field === 'isDeleted') return value === true ? 'deleted' : 'present';
	if (typeof value === 'string') return value;
	if (typeof value === 'boolean' || typeof value === 'number') return String(value);
	return JSON.stringify(value);
};

/** Whether a change is worth a line of its own: both sides empty, or the same move retold. */
export const shows = (change: HistoryChange): boolean =>
	!IDENTITIES.has(change.field) &&
	(valueText(change.field, change.before) !== null ||
		valueText(change.field, change.after) !== null);

/** The changes of one item that are worth showing, in the journal's own order. */
export const visibleChanges = (item: HistoryItem): readonly HistoryChange[] =>
	item.changes.filter(shows);
