import { floorUnit, isoWeek, nextUnit } from '$lib/model/Axis/Axis';
import { weekLabelPrefix } from '$lib/model/Axis/constants';
import type { MarkTime } from '$lib/model/Projection/types';
import { dateTimeFormat } from '$lib/state/Locale/format';
import type { Locale } from '$lib/state/Locale/types';
import { MIN_GROUPED } from './constants';
import type { GroupUnit, RecordGroup, RecordShape } from './types';

/** The ribbon's mark for a record's time: an intention dotted, an interval a band, a vague window pale. */
export const recordShape = (
	time: Pick<MarkTime, 'kind' | 'intent'> | null | undefined
): RecordShape =>
	time?.intent
		? 'intent'
		: time?.kind === 'interval'
			? 'interval'
			: time?.kind === 'fuzzy'
				? 'fuzzy'
				: 'fact';

const DAY_MS = 86_400_000;

/** The header of a stretch, in the axis's calendar (UTC, weeks from Monday). */
export const groupLabel = (start: number, unit: GroupUnit, language: Locale): string => {
	const day = (at: number, month = true) =>
		dateTimeFormat(language, {
			day: 'numeric',
			...(month && { month: 'short' }),
			timeZone: 'UTC'
		}).format(at);
	if (unit === 'month')
		return dateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
			start
		);
	if (unit === 'day')
		return dateTimeFormat(language, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		}).format(start);
	const last = nextUnit(start, 'week') - DAY_MS;
	const sameMonth = new Date(start).getUTCMonth() === new Date(last).getUTCMonth();
	return `${weekLabelPrefix(language)}${isoWeek(start)} · ${day(start, !sameMonth)}–${day(last)}`;
};

/**
 * A list cut into calendar stretches in its own order (newest first stays newest first); a
 * short list, or one inside a single stretch, stays whole under no header.
 */
export const groupRecords = <T extends Readonly<{ at?: number }>>(
	items: readonly T[],
	unit: GroupUnit | null,
	language: Locale
): RecordGroup<T>[] => {
	const whole = [{ key: 0, label: '', items }];
	if (!unit || items.length < MIN_GROUPED) return whole;
	const groups: { key: number; label: string; items: T[] }[] = [];
	for (const item of items) {
		const key = item.at === undefined ? Number.NaN : floorUnit(item.at, unit);
		const last = groups.at(-1);
		if (last && (last.key === key || (Number.isNaN(key) && Number.isNaN(last.key))))
			last.items.push(item);
		else
			groups.push({
				key,
				label: Number.isNaN(key) ? '' : groupLabel(key, unit, language),
				items: [item]
			});
	}
	return groups.length > 1 ? groups : whole;
};
