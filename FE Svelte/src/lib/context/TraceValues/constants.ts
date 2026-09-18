import type { MessageKey } from '$lib/state/Locale/types';
import type { SummaryDiagnostic } from '$lib/model/TraceForm/summary';

/** What a row says when it cannot read a record's Kind, version or values (P1). */
export const SUMMARY_DIAGNOSTIC_KEYS: Record<SummaryDiagnostic, MessageKey> = {
	kind: 'trace.kindUnreadable',
	version: 'trace.versionUnreadable',
	values: 'trace.valuesUnreadable'
};
