import { Temporal } from 'temporal-polyfill';
import type { TraceAboutTime } from '$lib/state/triplit/types';
import { planPlacement } from '../MoveIntention/MoveIntention';
import type { WhenChoice, WhenContext, WhenResult, WhenTrace, WhenView } from './types';

const isDayBearing = (
	value: TraceAboutTime | null
): value is Extract<TraceAboutTime, { basis: 'absolute' }> =>
	value?.basis === 'absolute' && (value.precision === 'minute' || value.precision === 'day');
const toPlainDate = (instant: number, zone: string) =>
	Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(zone).toPlainDate();
const dayKeyAt = (instant: number, zone: string) => toPlainDate(instant, zone).toString();

const zonedStrict = (dateTime: Temporal.PlainDateTime, zone: string) => {
	const zoned = dateTime.toZonedDateTime(zone, { disambiguation: 'earlier' });
	if (!zoned.toPlainDateTime().equals(dateTime)) throw new RangeError('Nonexistent local time');
	return zoned;
};

const aboutKindFor = (trace: WhenTrace) => (trace.statedDuration ? 'interval' : trace.aboutKind);

const isWeekPlaceholder = (trace: WhenTrace) => {
	const value = trace.aboutTime;
	if (
		trace.statedDuration ||
		value?.basis !== 'absolute' ||
		value.precision !== 'day' ||
		value.certainty !== 'exact' ||
		!value.end
	)
		return false;
	try {
		const start = Temporal.PlainDate.from(value.start.slice(0, 10));
		return (
			start.dayOfWeek === 1 &&
			Temporal.PlainDate.from(value.end.slice(0, 10)).equals(start.add({ days: 6 }))
		);
	} catch {
		return false;
	}
};

const moveAbsoluteDay = (
	value: Extract<TraceAboutTime, { basis: 'absolute' }>,
	day: Temporal.PlainDate,
	zone: string,
	clearTime = false
): TraceAboutTime => {
	const sourceStart =
		value.precision === 'minute'
			? Temporal.Instant.from(value.start).toZonedDateTimeISO(zone)
			: Temporal.PlainDate.from(value.start.slice(0, 10)).toPlainDateTime();
	const time =
		value.precision === 'minute' && !clearTime
			? sourceStart.toPlainTime()
			: Temporal.PlainTime.from('00:00');
	const destinationStart = day.toPlainDateTime(time);
	let destinationEnd: Temporal.ZonedDateTime | Temporal.PlainDateTime | null = null;
	if (value.end) {
		const sourceEnd =
			value.precision === 'minute'
				? Temporal.Instant.from(value.end).toZonedDateTimeISO(zone).toPlainDateTime()
				: Temporal.PlainDate.from(value.end.slice(0, 10)).toPlainDateTime();
		const sourceStartLocal =
			value.precision === 'minute'
				? Temporal.Instant.from(value.start).toZonedDateTimeISO(zone).toPlainDateTime()
				: Temporal.PlainDate.from(value.start.slice(0, 10)).toPlainDateTime();
		const wallLength = sourceStartLocal.until(sourceEnd, { largestUnit: 'days' });
		const endLocal = destinationStart.add(wallLength);
		destinationEnd = value.precision === 'minute' ? zonedStrict(endLocal, zone) : endLocal;
	}
	if (value.precision === 'minute') {
		const startZoned = zonedStrict(destinationStart, zone);
		return {
			basis: 'absolute',
			precision: clearTime ? 'day' : 'minute',
			certainty: value.certainty,
			start: clearTime ? day.toString() : startZoned.toString({ timeZoneName: 'never' }),
			end: clearTime
				? destinationEnd
					? destinationEnd.toPlainDate().toString()
					: null
				: (destinationEnd?.toString({ timeZoneName: 'never' }) ?? null)
		};
	}
	return {
		basis: 'absolute',
		precision: 'day',
		certainty: value.certainty,
		start: day.toString(),
		end: destinationEnd?.toPlainDate().toString() ?? null
	};
};

const dayPlacement = (
	trace: WhenTrace,
	day: Temporal.PlainDate,
	context: WhenContext
): WhenResult => {
	const value = trace.aboutTime;
	if (isDayBearing(value)) {
		try {
			const aboutTime = moveAbsoluteDay(
				isWeekPlaceholder(trace) ? { ...value, end: null } : value,
				day,
				context.zone
			);
			return {
				ok: true,
				fields: {
					aboutKind: aboutKindFor(trace),
					aboutTime,
					statedDuration: trace.statedDuration ?? null
				}
			};
		} catch {
			return { ok: false, reason: 'invalid_target' };
		}
	}
	return planPlacement(trace, { kind: 'day', dayKey: day.toString() }, context.zone);
};

export const planWhen = (
	trace: WhenTrace,
	choice: WhenChoice,
	context: WhenContext
): WhenResult => {
	try {
		if (choice.kind === 'week')
			return planPlacement(trace, { kind: 'week', weekStart: context.weekStart }, context.zone);
		if (choice.kind === 'undated') return planPlacement(trace, choice, context.zone);
		if (choice.kind === 'today')
			return dayPlacement(trace, toPlainDate(context.now, context.zone), context);
		if (choice.kind === 'tomorrow')
			return dayPlacement(trace, toPlainDate(context.now, context.zone).add({ days: 1 }), context);
		if (choice.kind === 'day')
			return dayPlacement(trace, Temporal.PlainDate.from(choice.dayKey), context);
		const value = trace.aboutTime;
		if (!isDayBearing(value)) return { ok: false, reason: 'needs_day' };
		if (isWeekPlaceholder(trace)) return { ok: false, reason: 'needs_day' };
		const date =
			value.precision === 'minute'
				? Temporal.Instant.from(value.start).toZonedDateTimeISO(context.zone).toPlainDate()
				: Temporal.PlainDate.from(value.start.slice(0, 10));
		if (choice.kind === 'clearTime') {
			if (value.precision === 'minute' && value.end) return { ok: false, reason: 'needs_full' };
			const aboutTime = moveAbsoluteDay(value, date, context.zone, true);
			return {
				ok: true,
				fields: {
					aboutKind: aboutKindFor(trace),
					aboutTime,
					statedDuration: trace.statedDuration ?? null
				}
			};
		}
		if (
			!Number.isInteger(choice.hours) ||
			choice.hours < 0 ||
			choice.hours > 23 ||
			!Number.isInteger(choice.minutes) ||
			choice.minutes < 0 ||
			choice.minutes > 59
		)
			return { ok: false, reason: 'invalid_target' };
		const time = Temporal.PlainTime.from({ hour: choice.hours, minute: choice.minutes });
		const startLocal = date.toPlainDateTime(time);
		const startZoned = startLocal.toZonedDateTime(context.zone, { disambiguation: 'earlier' });
		if (!startZoned.toPlainDateTime().equals(startLocal))
			return { ok: false, reason: 'invalid_target' };
		let end: string | null = null;
		if (value.end) {
			const originalStart =
				value.precision === 'minute'
					? Temporal.Instant.from(value.start).toZonedDateTimeISO(context.zone).toPlainDateTime()
					: Temporal.PlainDate.from(value.start.slice(0, 10)).toPlainDateTime();
			const originalEnd =
				value.precision === 'minute'
					? Temporal.Instant.from(value.end).toZonedDateTimeISO(context.zone).toPlainDateTime()
					: Temporal.PlainDate.from(value.end.slice(0, 10)).toPlainDateTime();
			const wallLength = originalStart.until(originalEnd, { largestUnit: 'days' });
			end = zonedStrict(startLocal.add(wallLength), context.zone).toString({
				timeZoneName: 'never'
			});
		}
		return {
			ok: true,
			fields: {
				aboutKind: aboutKindFor(trace),
				statedDuration: trace.statedDuration ?? null,
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: value.certainty,
					start: startZoned.toString({ timeZoneName: 'never' }),
					end
				}
			}
		};
	} catch {
		return { ok: false, reason: 'invalid_target' };
	}
};

export const whenView = (trace: WhenTrace, context: WhenContext): WhenView => {
	const value = trace.aboutTime;
	const isExact = value?.basis === 'absolute' && value.certainty === 'exact';
	const empty = (placement: WhenView['placement'], exact: boolean): WhenView => ({
		placement,
		weekStart: null,
		dayKey: null,
		time: null,
		canSetTime: false,
		canClearTime: value?.basis === 'absolute' && value.precision === 'minute' && value.end === null,
		isExact: exact
	});
	if (!value || value.basis === 'unknown') return empty('undated', false);
	if (value.basis === 'relative' || !isExact) return empty('inexact', false);
	if (!isDayBearing(value)) return empty('inexact', true);
	if (isWeekPlaceholder(trace))
		return { ...empty('week', true), weekStart: value.start.slice(0, 10) };
	try {
		if (value.precision === 'minute') {
			const localTime = Temporal.Instant.from(value.start)
				.toZonedDateTimeISO(context.zone)
				.toPlainTime();
			return {
				placement: 'day',
				weekStart: null,
				dayKey: dayKeyAt(Temporal.Instant.from(value.start).epochMilliseconds, context.zone),
				time: { hours: localTime.hour, minutes: localTime.minute },
				canSetTime: true,
				canClearTime: value.end === null,
				isExact: true
			};
		}
		return {
			placement: 'day',
			weekStart: null,
			dayKey: value.start.slice(0, 10),
			time: null,
			canSetTime: true,
			canClearTime: false,
			isExact: true
		};
	} catch {
		return empty('inexact', false);
	}
};
