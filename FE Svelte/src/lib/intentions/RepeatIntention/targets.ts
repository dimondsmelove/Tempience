import { Temporal } from 'temporal-polyfill';

export type RepeatDays = { tomorrow: string; nextWeek: string };

/** Calendar-day targets in the supplied IANA zone, based on one injected instant. */
export const repeatDays = (now: number, zone: string): RepeatDays => {
	const today = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone).toPlainDate();
	return {
		tomorrow: today.add({ days: 1 }).toString(),
		nextWeek: today.add({ days: 7 }).toString()
	};
};
