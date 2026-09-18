import type { Locale } from '$lib/state/Locale/types';
import { traceRecordText } from '$lib/state/triplit/Traces/fields';
import type { JsonObject, TraceKind, TraceKindV } from '$lib/state/triplit/types';
import { traceFormDisplay } from './display';

/** What a row could not read while the stored record itself stays as it is. */
export type SummaryDiagnostic = 'kind' | 'version' | 'values';

/** One own value of a typed record, as its Kind version formats it. */
export type SummaryValue = Readonly<{ label: string; value: string }>;

/**
 * What a relation row, a picker entry or a neighbour shows about a record (P1): its own label,
 * its own text and its Kind's own values as separate information. The date belongs to the row,
 * not here. `title` is null when nothing readable names the record, so the surface can say so
 * in its own words instead of rendering an empty line.
 */
export type TraceSummary = Readonly<{
	title: string | null;
	/** The plain record's description, or a typed record's own comment; never its values. */
	description: string | null;
	/** The row summary: the version's summary leaves the record has values for. */
	values: readonly SummaryValue[];
	/** Every own value the record holds, for a panel that has room for them. */
	fields: readonly SummaryValue[];
	diagnostic: SummaryDiagnostic | null;
}>;

/** The record fields a summary reads, from the repository row or the Explorer snapshot. */
export type SummaryTrace = Readonly<{
	content: string;
	description?: string | null;
	kindId: string | null;
	kindVId?: string | null;
	data?: JsonObject | null;
	/** The Kind's own name, when the snapshot already resolved it. */
	kindLabel?: string;
	displayFields?: readonly SummaryValue[];
	conciseFields?: readonly SummaryValue[];
}>;

export type KindCatalog = Readonly<{
	kinds: readonly TraceKind[];
	versions: readonly TraceKindV[];
}>;

const text = (value: string | null | undefined): string | null => {
	const trimmed = (value ?? '').trim();
	return trimmed.length > 0 ? trimmed : null;
};

/** The record's own text as it is stored, whichever shape the caller passed. */
const recordText = (trace: SummaryTrace) =>
	traceRecordText({ ...trace, description: trace.description ?? null });

const plain = (trace: SummaryTrace): TraceSummary => {
	const record = recordText(trace);
	return {
		title: text(record.title),
		description: text(record.description),
		values: [],
		fields: [],
		diagnostic: null
	};
};

/**
 * A typed record read through its own Kind version: the Kind names the row and its fields are
 * the values. A schema without its own title falls back to the Kind's actual name, so a legal
 * definition never reads as a generic record.
 */
const fromCatalog = (trace: SummaryTrace, catalog: KindCatalog, language: Locale): TraceSummary => {
	const kind = catalog.kinds.find((entry) => entry.id === trace.kindId) ?? null;
	const version = trace.kindVId
		? (catalog.versions.find((entry) => entry.id === trace.kindVId) ?? null)
		: null;
	const description = text(recordText(trace).description);
	if (!version) {
		return {
			title: kind?.name ?? null,
			description,
			values: [],
			fields: [],
			diagnostic: kind ? 'version' : 'kind'
		};
	}
	// The schema may name itself; otherwise the Kind does. A Kind this replica does not have
	// is said to be missing rather than replaced by a generic word.
	const schemaTitle =
		typeof version.dataSchema.title === 'string' ? version.dataSchema.title : null;
	const title = schemaTitle ?? kind?.name ?? null;
	try {
		const display = traceFormDisplay(version, trace.data ?? {}, kind?.name, language);
		return {
			title,
			description,
			values: display.conciseFields,
			fields: display.displayFields,
			diagnostic: kind ? null : 'kind'
		};
	} catch {
		// The stored data stays as it is; only this reading of it failed.
		return { title, description, values: [], fields: [], diagnostic: 'values' };
	}
};

/**
 * The one reading of a record for every row that lists records. A snapshot that already
 * resolved the Kind is used as it is; a raw repository row is read through the catalogs.
 */
export const traceSummary = (
	trace: SummaryTrace,
	catalog?: KindCatalog,
	language: Locale = 'ru'
): TraceSummary => {
	if (trace.kindId === null) return plain(trace);
	if (catalog) return fromCatalog(trace, catalog, language);
	const description = text(recordText(trace).description);
	return {
		title: text(trace.kindLabel),
		description,
		values: trace.conciseFields ?? trace.displayFields ?? [],
		fields: trace.displayFields ?? [],
		diagnostic: trace.kindLabel === undefined ? 'version' : null
	};
};

/** The row summary's values, for a row that has room for that many of them. */
export const conciseValues = (summary: TraceSummary, limit = 2): readonly SummaryValue[] =>
	summary.values.slice(0, limit);
