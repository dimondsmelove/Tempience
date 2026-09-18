import { locale } from '$lib/state/Locale/Locale.svelte';
import { evaluateIntention } from '$lib/state/triplit/IntentionAssessments/result';
import type {
	IntentionAssessment,
	IntentionOutcome
} from '$lib/state/triplit/IntentionAssessments/types';
import { traceSummary, type KindCatalog, type TraceSummary } from '$lib/model/TraceForm/summary';
import { traceSpan } from '$lib/state/triplit/Traces/event-time';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import { calendarValueBounds } from '$lib/state/triplit/trace-time';
import type { LinkHead } from '$lib/state/triplit/Intersections/heads';
import type { Trace } from '$lib/state/triplit/types';

/** The derived state of an intention as the picker and a chosen target show it. */
export type IntentionState = Readonly<{ outcome: IntentionOutcome | null; open: boolean }>;

/** One record as the result picker and the chosen targets read it. */
export type ResultRow = Readonly<{
	trace: Trace;
	/** What names the record in a row: its title, or its Kind for a typed record (P1). */
	summary: TraceSummary;
	/** The text a search matches: the label and the record's own description. */
	title: string;
	description: string | null;
	/** Direct Scope memberships, the optional Scope filter's basis. */
	scopeIds: readonly string[];
	/** Whether the record has an absolute event date (E3: only such facts assess). */
	dated: boolean;
	/** An intention's current outcome and openness by the independent projection; null for a fact. */
	state: IntentionState | null;
}>;

/** Which records a block offers: intentions for a fact's results, facts for an intention's. */
export type ResultRole = 'intention' | 'fact';

export type ResultFilter = Readonly<{
	role: ResultRole;
	/** The edited record itself, never a candidate. */
	selfId: string | null;
	query: string;
	scopeId: string;
	/** Calendar days (YYYY-MM-DD) the record's own time must touch; blank is unconstrained. */
	from: string;
	to: string;
	/** Intentions only: closed ones too; by default the open projection decides. */
	all: boolean;
}>;

const dayStart = (day: string): number | null => {
	try {
		return calendarValueBounds(day, 'day').start;
	} catch {
		return null;
	}
};

const dayEnd = (day: string): number | null => {
	try {
		return calendarValueBounds(day, 'day').end;
	} catch {
		return null;
	}
};

/** The record's own span in ms, or null without an absolute time. */
const spanOf = traceSpan;

/**
 * Every record with its text, direct Scopes and, for an intention, the state the result
 * projection derives from the eligible sources. Deleted rows are kept so a chosen record
 * that went away is shown as such rather than dropped.
 */
export const resultRows = (
	traces: readonly Trace[],
	intersections: readonly LinkHead[],
	assessments: readonly IntentionAssessment[],
	catalog?: KindCatalog
): ReadonlyMap<string, ResultRow> => {
	const tracesById = new Map(traces.map((trace) => [trace.id, trace] as const));
	const intersectionsById = new Map(intersections.map((link) => [link.id, link] as const));
	const scopes = new Map<string, string[]>();
	for (const link of intersections) {
		if (link.kind !== 'belongs_to' || link.fromEntityType === 'traceKind' || link.isDeleted)
			continue;
		scopes.set(link.fromId, [...(scopes.get(link.fromId) ?? []), link.toId]);
	}
	const rows = new Map<string, ResultRow>();
	for (const trace of traces) {
		const summary = traceSummary(trace, catalog, locale.current);
		const intention = isIntentionRelation(trace.relation);
		const result = intention
			? evaluateIntention(trace.id, assessments, { tracesById, intersectionsById })
			: null;
		rows.set(trace.id, {
			trace,
			summary,
			title: summary.title ?? '',
			description: summary.description,
			scopeIds: scopes.get(trace.id) ?? [],
			dated: spanOf(trace) !== null,
			state: result ? { outcome: result.outcome.value, open: result.open.value } : null
		});
	}
	return rows;
};

const matchesText = (row: ResultRow, needle: string): boolean =>
	needle.length === 0 ||
	row.title.toLocaleLowerCase().includes(needle) ||
	(row.description ?? '').toLocaleLowerCase().includes(needle);

/** A bound that does not read as a day constrains nothing; a set bound excludes undated rows. */
const matchesPeriod = (row: ResultRow, from: string, to: string): boolean => {
	const start = from ? dayStart(from) : null;
	const end = to ? dayEnd(to) : null;
	if (start === null && end === null) return true;
	const span = spanOf(row.trace);
	if (!span) return false;
	return (start === null || span.end > start) && (end === null || span.start < end);
};

/** The record's own time key, so the order never depends on outcome or openness. */
const timeKey = (row: ResultRow): number | null => spanOf(row.trace)?.start ?? null;

/** Dated records first by their own time, undated after, ties by title: a semantic order. */
export const compareResultRows = (a: ResultRow, b: ResultRow): number => {
	const left = timeKey(a);
	const right = timeKey(b);
	if (left !== null && right !== null && left !== right) return left - right;
	if ((left === null) !== (right === null)) return left === null ? 1 : -1;
	return a.title.localeCompare(b.title) || a.trace.id.localeCompare(b.trace.id);
};

/**
 * The candidates a filter admits: the role's active records other than the edited one,
 * open intentions unless «Все», then the text, Scope and period constraints. Every
 * constraint is optional and works alone; none of them touches what is already chosen.
 */
export const resultCandidates = (
	rows: ReadonlyMap<string, ResultRow>,
	filter: ResultFilter
): ResultRow[] => {
	const needle = filter.query.trim().toLocaleLowerCase();
	return [...rows.values()]
		.filter((row) => {
			const intention = isIntentionRelation(row.trace.relation);
			if (row.trace.isDeleted || row.trace.id === filter.selfId) return false;
			if (intention !== (filter.role === 'intention')) return false;
			if (intention && !filter.all && row.state?.open !== true) return false;
			if (filter.scopeId && !row.scopeIds.includes(filter.scopeId)) return false;
			return matchesText(row, needle) && matchesPeriod(row, filter.from, filter.to);
		})
		.toSorted(compareResultRows);
};
