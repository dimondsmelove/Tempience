import { spanTouches } from '$lib/state/triplit/Traces/event-time';
import type { KindIndexRow } from '$lib/state/triplit/trace-dataset';
import { calendarValueBounds } from '$lib/state/triplit/trace-time';
import { PAGE_SIZE } from './constants';
import type { Period, VersionRows } from './types';

const dayBound = (day: string, edge: 'start' | 'end'): number | null => {
	if (!day) return null;
	try {
		return calendarValueBounds(day, 'day')[edge];
	} catch {
		return null;
	}
};

/** The bounds of a period in ms; a bound that does not read as a day constrains nothing. */
export const periodBounds = (period: Period): { from: number | null; to: number | null } => ({
	from: dayBound(period.from, 'start'),
	to: dayBound(period.to, 'end')
});

/** The E3 order of a version's dated rows: the latest event first, then the latest captured. */
export const byEventNewestFirst = (a: KindIndexRow, b: KindIndexRow): number =>
	(b.key ?? '').localeCompare(a.key ?? '') ||
	b.capturedAt.localeCompare(a.capturedAt) ||
	a.id.localeCompare(b.id);

/** The order of the rows without a date: the latest captured first. */
export const byCaptureNewestFirst = (a: KindIndexRow, b: KindIndexRow): number =>
	b.capturedAt.localeCompare(a.capturedAt) || a.id.localeCompare(b.id);

/**
 * The index rows by their own version, under the period: the dated rows ordered by event, the
 * undated ones apart, by capture. A set bound leaves the undated rows out — they touch no
 * period. A record keeps the version it was written with, whatever its date.
 */
export const placeByVersion = (
	rows: readonly KindIndexRow[],
	period: Period
): ReadonlyMap<string, VersionRows> => {
	const { from, to } = periodBounds(period);
	const bounded = from !== null || to !== null;
	const groups = new Map<string, { dated: KindIndexRow[]; undated: KindIndexRow[] }>();
	const groupOf = (kindVId: string) => {
		let group = groups.get(kindVId);
		if (!group) {
			group = { dated: [], undated: [] };
			groups.set(kindVId, group);
		}
		return group;
	};
	for (const row of rows) {
		if (row.key === null || row.span === null) {
			if (!bounded) groupOf(row.kindVId).undated.push(row);
			continue;
		}
		if (bounded && !spanTouches(row.span, from, to)) continue;
		groupOf(row.kindVId).dated.push(row);
	}
	const placed = new Map<string, VersionRows>();
	for (const [kindVId, group] of groups) {
		placed.set(kindVId, {
			dated: group.dated.sort(byEventNewestFirst),
			undated: group.undated.sort(byCaptureNewestFirst)
		});
	}
	return placed;
};

export const pageCount = (count: number): number => Math.max(1, Math.ceil(count / PAGE_SIZE));

export const pageOf = <T>(rows: readonly T[], page: number): readonly T[] =>
	rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

/** The last page a list has, for a page number kept from before the list shrank. */
export const clampPage = (page: number, count: number): number =>
	Math.min(Math.max(0, page), pageCount(count) - 1);
