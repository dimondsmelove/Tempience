import { Temporal } from 'temporal-polyfill';
import { CodedError } from '$lib/model/Errors/CodedError';
import type { PracticeTarget } from './types';

/** A whole week of minutes is the largest budget that can be met. */
export const MAX_WEEKLY_MINUTES = 7 * 24 * 60;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The Monday of the ISO week holding a local calendar date. */
export const mondayOf = (date: string): string => {
	const day = Temporal.PlainDate.from(date);
	return day.subtract({ days: day.dayOfWeek - 1 }).toString();
};

/** The Monday of the week holding `now` on the wall clock of `timezone`. */
export const currentWeek = (now: Date, timezone: string): string =>
	mondayOf(
		Temporal.Instant.fromEpochMilliseconds(now.getTime())
			.toZonedDateTimeISO(timezone)
			.toPlainDate()
			.toString()
	);

export const validWeeklyMinutes = (value: unknown): value is number | null =>
	value === null ||
	(typeof value === 'number' &&
		Number.isInteger(value) &&
		value > 0 &&
		value <= MAX_WEEKLY_MINUTES);

const isMonday = (value: unknown): value is string =>
	typeof value === 'string' && DATE.test(value) && Temporal.PlainDate.from(value).dayOfWeek === 1;

export const parsePracticeTarget = (input: unknown): PracticeTarget => {
	const row = input as Record<string, unknown> | null;
	const minutes = row?.minutesPerWeek ?? null;
	if (
		!row ||
		typeof row.id !== 'string' ||
		!row.id ||
		row.sourceId !== 'source' ||
		typeof row.scopeId !== 'string' ||
		!row.scopeId ||
		!validWeeklyMinutes(minutes) ||
		!isMonday(row.effectiveFromWeek) ||
		typeof row.createdAt !== 'string' ||
		Number.isNaN(Date.parse(row.createdAt)) ||
		typeof row.isDeleted !== 'boolean'
	)
		throw new CodedError('practice_target_format', 'A weekly practice budget is malformed');
	return {
		id: row.id,
		sourceId: 'source',
		scopeId: row.scopeId,
		minutesPerWeek: minutes,
		effectiveFromWeek: row.effectiveFromWeek,
		createdAt: row.createdAt,
		isDeleted: row.isDeleted
	};
};

const later = (a: PracticeTarget, b: PracticeTarget): boolean =>
	a.effectiveFromWeek !== b.effectiveFromWeek
		? a.effectiveFromWeek > b.effectiveFromWeek
		: a.createdAt !== b.createdAt
			? a.createdAt > b.createdAt
			: a.id > b.id;

/** The statement in force for `scopeId` in the week of `date`, or null when none was made. */
export const targetRowFor = (
	rows: readonly PracticeTarget[],
	scopeId: string,
	date: string
): PracticeTarget | null => {
	const week = mondayOf(date);
	let found: PracticeTarget | null = null;
	for (const row of rows)
		if (
			!row.isDeleted &&
			row.scopeId === scopeId &&
			row.effectiveFromWeek <= week &&
			(!found || later(row, found))
		)
			found = row;
	return found;
};

/** The weekly budget of `scopeId` in the week of `date`; null means «no goal». */
export const weeklyTargetFor = (
	rows: readonly PracticeTarget[],
	scopeId: string,
	date: string
): number | null => targetRowFor(rows, scopeId, date)?.minutesPerWeek ?? null;
