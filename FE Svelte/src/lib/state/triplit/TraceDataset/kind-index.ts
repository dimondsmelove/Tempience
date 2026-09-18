import { parseStatedDuration } from '../trace-duration';
import type { TraceAboutKind } from '../types';
import { traceEventKey, traceSpan } from '../Traces/event-time';
import { readStoredTraceTime } from '../Traces/stored-time';
import type { KindIndexRow, UnknownRecord } from './types';

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** One index row: the record's E3 key and span, or neither and a note that its time was unreadable. */
export const indexRow = (value: unknown, knownKindVIds: ReadonlySet<string>): KindIndexRow => {
	const record = value as UnknownRecord;
	const id = String(record.id);
	if (typeof record.kindVId !== 'string' || !knownKindVIds.has(record.kindVId)) {
		throw new Error(`Trace ${id} references an unavailable TraceKindV`);
	}
	const base = { id, kindVId: record.kindVId, capturedAt: String(record.capturedAt) };
	try {
		const aboutKind = record.aboutKind as TraceAboutKind;
		const placement = {
			aboutKind,
			aboutTime: readStoredTraceTime(record, aboutKind, {
				aboutAt: text(record.aboutAt),
				aboutStart: text(record.aboutStart),
				aboutEnd: text(record.aboutEnd)
			}),
			statedDuration: parseStatedDuration(record.statedDuration)
		};
		return { ...base, key: traceEventKey(placement), span: traceSpan(placement) };
	} catch {
		return { ...base, key: null, span: null, unreadable: true };
	}
};

export const indexRows = (
	values: readonly unknown[],
	knownKindVIds: ReadonlySet<string>
): KindIndexRow[] => values.map((value) => indexRow(value, knownKindVIds));
