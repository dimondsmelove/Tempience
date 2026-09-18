import type { NowSlice } from '@chronograph/shared';
import type { traces } from '../../db/schema';
import { mapInquiry } from '../temporal-mappers';
import { minuteOfWeek, traceMinuteOfWeek, weekBounds, weekProgress } from './week-minute';

type TraceRow = typeof traces.$inferSelect;

const isIntentTrace = (row: TraceRow): boolean =>
	row.hookKind === 'intent' || row.relation === 'intend';

const toSummary = (row: TraceRow, weekStart: string, timeZone: string) => ({
	uid: row.uid,
	hook_text: row.hookText,
	hook_kind: row.hookKind,
	relation: row.relation ?? null,
	word: row.word ?? null,
	about_at: row.aboutAt ?? null,
	about_start: row.aboutStart ?? null,
	about_end: row.aboutEnd ?? null,
	about_trace_uid: row.aboutTraceUid ?? null,
	task_ref: row.taskRef ?? null,
	minute_of_week: traceMinuteOfWeek(row, weekStart, timeZone)
});

export const buildNowSlice = (input: {
	anchorAt: string;
	timezone: string;
	weekStart: string;
	traceRows: TraceRow[];
}): NowSlice => {
	const { week_start, week_end } = weekBounds(input.weekStart, input.timezone);
	const minute = minuteOfWeek(input.anchorAt, week_start, input.timezone);
	const anchorMs = new Date(input.anchorAt).getTime();

	const intents = input.traceRows.filter(isIntentTrace);
	const intentsAhead = intents
		.filter((row) => {
			const at = row.aboutAt ?? row.aboutStart;
			return at ? new Date(at).getTime() >= anchorMs : false;
		})
		.map((row) => toSummary(row, week_start, input.timezone));

	const intentsElapsed = intents
		.filter((row) => {
			const at = row.aboutAt ?? row.aboutStart;
			return at ? new Date(at).getTime() < anchorMs : false;
		})
		.map((row) => toSummary(row, week_start, input.timezone));

	return {
		anchor_at: input.anchorAt,
		timezone: input.timezone,
		week_start,
		week_end,
		minute_of_week: minute,
		week_progress: weekProgress(minute),
		zoom: 'week',
		traces: input.traceRows.map((row) => toSummary(row, week_start, input.timezone)),
		intents_ahead: intentsAhead,
		intents_elapsed: intentsElapsed,
		lanes: [],
		tick_interval_seconds: 60
	};
};

export const mapOpenInquiries = (rows: Parameters<typeof mapInquiry>[0][]) => rows.map(mapInquiry);
