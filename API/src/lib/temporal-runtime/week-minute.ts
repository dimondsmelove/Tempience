import { minuteOfWeekInZone, weekWindowForZone } from '@chronograph/shared';
import { addDaysISO, weekEndISO, weekStartISO } from '../week';

export const minuteOfWeek = (anchorAt: string, weekStart: string, timeZone = 'UTC'): number =>
	minuteOfWeekInZone(anchorAt, weekStart, timeZone);

export const weekProgress = (minute: number): number => minute / 10_080;

export const resolveWeekStart = (anchorAt: string, weekStart?: string): string => {
	if (weekStart) return weekStartISO(weekStart);
	return weekStartISO(anchorAt.slice(0, 10));
};

export const weekBounds = (weekStart: string, timeZone = 'UTC') => ({
	week_start: weekStart,
	week_end: weekEndISO(weekStart),
	window: weekWindowForZone(weekStart, timeZone)
});

export const traceMinuteOfWeek = (
	trace: {
		aboutAt: string | null;
		aboutStart: string | null;
		capturedAt: string;
	},
	weekStart: string,
	timeZone = 'UTC'
): number | null => {
	const instant = trace.aboutAt ?? trace.aboutStart ?? trace.capturedAt;
	if (!instant) return null;
	return minuteOfWeek(instant, weekStart, timeZone);
};
