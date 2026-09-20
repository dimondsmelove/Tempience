import type { Entity } from '../Repository/types';
import { parseStatedDuration } from '../trace-duration';
import { assertTraceTemporalPlacement, exactTraceTimeProjection } from '../trace-time';
import type { Trace } from '../types';
import { traceRevisions } from './revisions';
import { readStoredTraceData, readStoredTraceTime, type StoredRowShape } from './stored-time';

/** The order every reader of the records shows them in: the latest captured first. */
export const byNewestCaptured = (a: Trace, b: Trace): number =>
	b.capturedAt.localeCompare(a.capturedAt);

/**
 * A stored row as the record it is. A row read through a selection (`shape: 'selected'`)
 * carries of its data only the paths the selection named; the record then holds exactly
 * those, which is what a thin read of records is for.
 */
export const normalizeTrace = (
	value: Record<string, unknown>,
	shape: StoredRowShape = 'stored'
): Trace => {
	const aboutKind = value.aboutKind as Trace['aboutKind'];
	const aboutTraceId = (value.aboutTraceId as string | null | undefined) ?? null;
	const aboutTime = readStoredTraceTime(value, aboutKind, {
		aboutAt: (value.aboutAt as string | null | undefined) ?? null,
		aboutStart: (value.aboutStart as string | null | undefined) ?? null,
		aboutEnd: (value.aboutEnd as string | null | undefined) ?? null
	});
	const statedDuration = parseStatedDuration(value.statedDuration);
	assertTraceTemporalPlacement(aboutKind, aboutTime, aboutTraceId, statedDuration);
	const exactTime = exactTraceTimeProjection(aboutKind, aboutTime, statedDuration);
	return {
		id: String(value.id),
		capturedAt: String(value.capturedAt),
		timezone: String(value.timezone),
		aboutKind,
		aboutTime,
		...exactTime,
		statedDuration,
		aboutTraceId,
		content: String(value.content),
		description: (value.description as string | null | undefined) ?? null,
		relation: (value.relation as Trace['relation'] | null | undefined) ?? null,
		kindId: (value.kindId as string | null | undefined) ?? null,
		kindVId: (value.kindVId as string | null | undefined) ?? null,
		data: readStoredTraceData(value, shape),
		isDeleted: Boolean(value.isDeleted),
		lifecycleId: traceRevisions(value as Entity).isDeleted ?? null,
		createdAt: String(value.createdAt),
		updatedAt: String(value.updatedAt)
	};
};
