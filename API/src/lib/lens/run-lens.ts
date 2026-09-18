import type { LensQuery, LensResult, RecallSlice, Trace } from '@chronograph/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopePhases, scopes, traces } from '../../db/schema';
import { listTraceUidsForScope } from '../scope/scope-trace-bindings';
import { scopeToContinuity } from '../scope/scope-mappers';
import { mapContinuitySegment, mapTrace } from '../temporal-mappers';
import { buildNowResponse } from '../temporal-runtime/now-service';
import { resolveWeekStart } from '../temporal-runtime/week-minute';
import { nowIso } from '../time';
import { buildOrientNow } from './build-orient-now';
import { sortRecallTraces } from './recall-trace-sort';

const buildThreadRecall = async (query: LensQuery): Promise<RecallSlice> => {
	const continuityUid = query.continuity_uid;
	if (!continuityUid) {
		throw new Error('continuity_uid required for thread-recall preset');
	}

	const [continuityRow] = await db
		.select()
		.from(scopes)
		.where(and(eq(scopes.uid, continuityUid), eq(scopes.kind, 'continuity')));
	if (!continuityRow) {
		throw new Error('Continuity not found');
	}

	const segmentRows = await db
		.select()
		.from(scopePhases)
		.where(eq(scopePhases.continuityUid, continuityUid))
		.orderBy(asc(scopePhases.sortOrder));

	const traceUids = listTraceUidsForScope(continuityUid);

	const traceRows =
		traceUids.length > 0
			? await db
					.select()
					.from(traces)
					.where(and(inArray(traces.uid, traceUids), isNull(traces.retractedAt)))
			: [];

	const mappedTraces = sortRecallTraces(traceRows.map(mapTrace) as Trace[]);

	return {
		preset: 'thread-recall',
		timezone: query.timezone,
		week_start: null,
		continuity: scopeToContinuity(continuityRow),
		segments: segmentRows.map(mapContinuitySegment),
		traces: mappedTraces,
		lanes: [],
		summary: {
			trace_count: mappedTraces.length,
			segment_count: segmentRows.length,
			continuity_name: continuityRow.name
		}
	} as RecallSlice;
};

const buildWeekRecall = async (query: LensQuery): Promise<RecallSlice> => {
	const anchorAt = query.anchor_at ?? nowIso();
	const weekStart = resolveWeekStart(anchorAt, query.week_start);
	const now = await buildNowResponse({
		timezone: query.timezone,
		week_start: weekStart,
		at: anchorAt,
		evaluate: false
	});

	const summaryUids = [
		...now.now.traces,
		...now.now.intents_ahead,
		...now.now.intents_elapsed
	].map((trace) => trace.uid);

	const traceRows =
		summaryUids.length > 0
			? await db
					.select()
					.from(traces)
					.where(and(inArray(traces.uid, summaryUids), isNull(traces.retractedAt)))
			: [];

	const mappedTraces = sortRecallTraces(traceRows.map(mapTrace) as Trace[]);

	return {
		preset: query.preset as 'atlas-week' | 'week-traces-only',
		timezone: query.timezone,
		week_start: now.now.week_start,
		continuity: null,
		segments: [],
		traces: mappedTraces,
		lanes: query.preset === 'week-traces-only' ? [] : now.now.lanes,
		summary: {
			trace_count: mappedTraces.length,
			segment_count: 0,
			continuity_name: null
		}
	} as RecallSlice;
};

export const runLens = async (query: LensQuery): Promise<LensResult> => {
	if (query.preset === 'orient-now') {
		return buildOrientNow(query);
	}
	if (query.preset === 'thread-recall') {
		return buildThreadRecall(query);
	}
	return buildWeekRecall(query);
};
