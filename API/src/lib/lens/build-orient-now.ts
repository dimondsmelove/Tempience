import type { Continuity, LensQuery, OrientNowSlice } from '@chronograph/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopePhases, scopes, traces } from '../../db/schema';
import { listScopeUidsForTrace } from '../scope/scope-trace-bindings';
import { scopeToContinuity } from '../scope/scope-mappers';
import { mapContinuitySegment, mapTrace } from '../temporal-mappers';
import { nowIso } from '../time';
import { continuityPole, countPoles, segmentActiveAt } from '@chronograph/shared';
import { pickActiveSegment } from '../capture/segment-bump';

const traceTimestamp = (row: typeof traces.$inferSelect): string =>
	row.aboutAt ?? row.aboutStart ?? row.capturedAt;

const findFocalTrace = async (
	anchorAt: string,
	traceUid?: string
): Promise<typeof traces.$inferSelect | null> => {
	if (traceUid) {
		const [row] = await db
			.select()
			.from(traces)
			.where(and(eq(traces.uid, traceUid), isNull(traces.retractedAt)));
		return row ?? null;
	}

	const rows = await db
		.select()
		.from(traces)
		.where(isNull(traces.retractedAt))
		.orderBy(asc(traces.capturedAt));

	if (rows.length === 0) return null;

	const anchorMs = new Date(anchorAt).getTime();
	let best: typeof traces.$inferSelect | null = null;
	let bestDelta = Number.POSITIVE_INFINITY;

	for (const row of rows) {
		const delta = Math.abs(new Date(traceTimestamp(row)).getTime() - anchorMs);
		if (delta < bestDelta) {
			best = row;
			bestDelta = delta;
		}
	}

	return best;
};

export const buildOrientNow = async (query: LensQuery): Promise<OrientNowSlice> => {
	const anchorAt = query.anchor_at ?? nowIso();

	const focalRow = await findFocalTrace(anchorAt, query.trace_uid);

	const linkedUids = new Set(focalRow ? listScopeUidsForTrace(focalRow.uid) : []);

	const continuityRows = await db
		.select()
		.from(scopes)
		.where(eq(scopes.kind, 'continuity'))
		.orderBy(asc(scopes.name));
	const segmentRows = await db
		.select()
		.from(scopePhases)
		.orderBy(asc(scopePhases.sortOrder));

	const segmentsByContinuity = new Map<string, typeof scopePhases.$inferSelect[]>();
	for (const segment of segmentRows) {
		const list = segmentsByContinuity.get(segment.continuityUid) ?? [];
		list.push(segment);
		segmentsByContinuity.set(segment.continuityUid, list);
	}

	const cards = continuityRows
		.map((continuity) => {
			const segments = segmentsByContinuity.get(continuity.uid) ?? [];
			const active = pickActiveSegment(segments, anchorAt);
			if (!active && !linkedUids.has(continuity.uid)) return null;
			if (
				active &&
				!segmentActiveAt(
					{ start_at: active.startAt, end_at: active.endAt },
					anchorAt
				) &&
				!linkedUids.has(continuity.uid)
			) {
				return null;
			}

			return {
				continuity: scopeToContinuity(continuity),
				active_segment: active ? mapContinuitySegment(active) : null,
				linked: linkedUids.has(continuity.uid),
				pole: continuityPole((continuity.facet ?? 'thread') as Continuity['kind'])
			};
		})
		.filter((card): card is NonNullable<typeof card> => card !== null);

	const linkedCards = cards.filter((card) => card.linked);
	const ambientCards = cards.filter((card) => !card.linked);
	const poleCounts = countPoles(
		cards.map((card) => card.continuity.kind as Continuity['kind'])
	);

	return {
		preset: 'orient-now',
		timezone: query.timezone,
		anchor_at: anchorAt,
		focal_trace: focalRow ? mapTrace(focalRow) : null,
		cards: [...linkedCards, ...ambientCards],
		summary: {
			linked_count: linkedCards.length,
			ambient_count: ambientCards.length,
			...poleCounts
		}
	} as OrientNowSlice;
};
