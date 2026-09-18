export type WallTime = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

export const MINUTES_PER_WEEK = 7 * 24 * 60;

export const wallTimeInZone = (instant: Date, timeZone: string): WallTime => {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).formatToParts(instant);

	const get = (type: string): number =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);

	return {
		year: get('year'),
		month: get('month'),
		day: get('day'),
		hour: get('hour'),
		minute: get('minute'),
		second: get('second')
	};
};

const calendarDateToUtcMs = (year: number, month: number, day: number): number =>
	Date.UTC(year, month - 1, day);

export const utcInstantForZonedLocal = (
	dateISO: string,
	hour: number,
	minute: number,
	timeZone: string
): Date => {
	const [y, m, d] = dateISO.split('-').map(Number);
	let guess = Date.UTC(y, m - 1, d, hour, minute, 0, 0);

	for (let i = 0; i < 4; i++) {
		const wall = wallTimeInZone(new Date(guess), timeZone);
		const desired = Date.UTC(y, m - 1, d, hour, minute, 0, 0);
		const actual = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0, 0);
		guess -= actual - desired;
	}

	return new Date(guess);
};

const dayOffsetFromWeekStart = (weekStart: string, wall: WallTime): number => {
	const [y, m, d] = weekStart.split('-').map(Number);
	const fromMs = calendarDateToUtcMs(y, m, d);
	const toMs = calendarDateToUtcMs(wall.year, wall.month, wall.day);
	return Math.round((toMs - fromMs) / 86_400_000);
};

export const addDaysISO = (dateISO: string, days: number): string => {
	const [y, m, d] = dateISO.split('-').map(Number);
	const next = new Date(Date.UTC(y, m - 1, d + days));
	return next.toISOString().slice(0, 10);
};

export const minuteOfWeekInZone = (
	anchorAt: string,
	weekStart: string,
	timeZone: string
): number => {
	const wall = wallTimeInZone(new Date(anchorAt), timeZone);
	const dayDiff = dayOffsetFromWeekStart(weekStart, wall);
	const minute = dayDiff * 24 * 60 + wall.hour * 60 + wall.minute;
	return Math.max(0, Math.min(MINUTES_PER_WEEK - 1, minute));
};

export const weekWindowForZone = (
	weekStart: string,
	timeZone: string
): { from: string; to: string } => {
	const from = utcInstantForZonedLocal(weekStart, 0, 0, timeZone).toISOString();
	const nextMonday = addDaysISO(weekStart, 7);
	const to = utcInstantForZonedLocal(nextMonday, 0, 0, timeZone).toISOString();
	return { from, to };
};

export const minuteToInstantInZone = (
	weekStart: string,
	minute: number,
	timeZone: string
): Date => {
	const day = Math.floor(minute / (24 * 60));
	const minuteOfDay = minute % (24 * 60);
	const hour = Math.floor(minuteOfDay / 60);
	const min = minuteOfDay % 60;
	const dayISO = addDaysISO(weekStart, day);
	return utcInstantForZonedLocal(dayISO, hour, min, timeZone);
};

export const formatMinuteInZone = (
	weekStart: string,
	minute: number,
	timeZone: string
): string =>
	new Intl.DateTimeFormat('ru-RU', {
		timeZone,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	}).format(minuteToInstantInZone(weekStart, minute, timeZone));

export const fractionalMinuteOfWeekInZone = (
	anchorAt: string,
	weekStart: string,
	timeZone: string
): number => {
	const instant = new Date(anchorAt);
	const wall = wallTimeInZone(instant, timeZone);
	const dayDiff = dayOffsetFromWeekStart(weekStart, wall);
	const dayISO = addDaysISO(weekStart, dayDiff);
	const minuteStart = utcInstantForZonedLocal(dayISO, wall.hour, wall.minute, timeZone);
	const subMinute = (instant.getTime() - minuteStart.getTime()) / 60_000;
	const safeSub = Math.max(0, Math.min(0.999_999, subMinute));
	const fractional = dayDiff * 24 * 60 + wall.hour * 60 + wall.minute + safeSub;
	return Math.max(0, Math.min(MINUTES_PER_WEEK, fractional));
};

export const formatFractionalMinuteInZone = (
	weekStart: string,
	fractionalMinute: number,
	timeZone: string,
	includeSeconds = false
): string => {
	const clamped = Math.max(0, Math.min(MINUTES_PER_WEEK, fractionalMinute));
	const wholeMinute = Math.min(MINUTES_PER_WEEK - 1, Math.floor(clamped));
	const second = Math.min(59, Math.round((clamped - wholeMinute) * 60));
	const instant = minuteToInstantInZone(weekStart, wholeMinute, timeZone);
	if (!includeSeconds) return formatMinuteInZone(weekStart, wholeMinute, timeZone);
	const withSecond = new Date(instant.getTime() + second * 1_000);
	return new Intl.DateTimeFormat('ru-RU', {
		timeZone,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).format(withSecond);
};
