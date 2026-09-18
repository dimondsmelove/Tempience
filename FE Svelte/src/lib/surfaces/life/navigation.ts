import type { LifeScopeFocus } from './scope-focus';

export type LifeScale = 'week' | 'month' | 'year' | 'decade';

export type LifePeriod = {
	from: string;
	to: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const parseDateParam = (value: string | null): string | null =>
	value && DATE_RE.test(value) ? value : null;

export const parseLifeScale = (value: string | null): LifeScale =>
	value === 'month' || value === 'year' || value === 'decade' ? value : 'week';

export const calendarYearBounds = (year: number): LifePeriod => ({
	from: `${year}-01-01`,
	to: `${year}-12-31`
});

export const decadeBounds = (decadeStart: number): LifePeriod => ({
	from: `${decadeStart}-01-01`,
	to: `${decadeStart + 9}-12-31`
});

export const calendarMonthBounds = (yearMonth: string): LifePeriod => {
	const [year, month] = yearMonth.split('-').map(Number);
	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const mm = String(month).padStart(2, '0');
	return {
		from: `${year}-${mm}-01`,
		to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
	};
};

export const displayYearForWeek = (weekStart: string, periodFrom: string): number => {
	const weekYear = Number(weekStart.slice(0, 4));
	const fromYear = Number(periodFrom.slice(0, 4));
	return weekYear < fromYear ? fromYear : weekYear;
};

export const defaultLifePeriod = (anchorDate: string): LifePeriod => {
	const year = Number(anchorDate.slice(0, 4));
	return calendarYearBounds(year);
};

export const lastNYearsPeriod = (anchorDate: string, years: number): LifePeriod => {
	const endYear = Number(anchorDate.slice(0, 4));
	const startYear = Math.max(1900, endYear - years + 1);
	return { from: `${startYear}-01-01`, to: `${endYear}-12-31` };
};

export const currentDecadePeriod = (anchorDate: string): LifePeriod => {
	const year = Number(anchorDate.slice(0, 4));
	const decadeStart = Math.floor(year / 10) * 10;
	return decadeBounds(decadeStart);
};

export const parseLifePeriod = (params: URLSearchParams, fallback: LifePeriod): LifePeriod => {
	const from = parseDateParam(params.get('from')) ?? fallback.from;
	const to = parseDateParam(params.get('to')) ?? fallback.to;
	return from <= to ? { from, to } : { from: to, to: from };
};

export type LifeUrlInput = {
	from: string;
	to: string;
	scale?: LifeScale;
	scope?: LifeScopeFocus | null;
	scopeIncludeFuture?: boolean;
};

export const lifeUrl = (input: LifeUrlInput): string => {
	const params = new URLSearchParams({ from: input.from, to: input.to });
	if (input.scale && input.scale !== 'week') params.set('scale', input.scale);
	if (input.scope) params.set('scope_id', input.scope.id);
	if (input.scopeIncludeFuture) params.set('scope_future', '1');
	return `/life?${params.toString()}`;
};

export const parseLifeScopeIncludeFuture = (params: URLSearchParams): boolean =>
	params.get('scope_future') === '1';
