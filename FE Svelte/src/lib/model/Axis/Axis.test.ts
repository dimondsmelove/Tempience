import { describe, expect, it } from 'vitest';
import {
	axisRows,
	axisSpec,
	axisTicks,
	floorUnit,
	isoWeek,
	nextUnit,
	periodAt,
	periodTitle,
	prevUnit,
	pxPerDay,
	stickyLabel
} from './Axis';
import { DAY_MS } from './constants';

const D = (year: number, month: number, day: number): number => Date.UTC(year, month - 1, day);

describe('calendar units', () => {
	it('floors weeks to Monday and days to midnight UTC', () => {
		const friday = D(2026, 9, 4) + 10 * 3_600_000;
		expect(floorUnit(friday, 'week')).toBe(D(2026, 8, 31));
		expect(floorUnit(friday, 'day')).toBe(D(2026, 9, 4));
		expect(floorUnit(friday, 'month')).toBe(D(2026, 9, 1));
		expect(floorUnit(friday, 'year')).toBe(D(2026, 1, 1));
	});

	it('steps forward and back across month and year boundaries', () => {
		expect(nextUnit(D(2025, 12, 1), 'month')).toBe(D(2026, 1, 1));
		expect(prevUnit(D(2026, 1, 1), 'month')).toBe(D(2025, 12, 1));
		expect(nextUnit(D(2026, 1, 1), 'year')).toBe(D(2027, 1, 1));
		expect(nextUnit(D(2026, 8, 31), 'week')).toBe(D(2026, 9, 7));
	});

	it('returns the containing period with an exclusive end', () => {
		expect(periodAt(D(2026, 9, 4), 'month')).toEqual({
			unit: 'month',
			start: D(2026, 9, 1),
			end: D(2026, 10, 1)
		});
	});
});

describe('isoWeek', () => {
	it('matches ISO-8601 for known dates', () => {
		expect(isoWeek(D(2026, 9, 4))).toBe(36);
		expect(isoWeek(D(2026, 1, 1))).toBe(1);
		expect(isoWeek(D(2025, 12, 29))).toBe(1);
		expect(isoWeek(D(2024, 12, 30))).toBe(1);
		expect(isoWeek(D(2021, 1, 3))).toBe(53);
	});
});

describe('axisSpec', () => {
	it('picks rows by fixed pixel-per-day bands', () => {
		expect(axisSpec(0.2)).toMatchObject({ major: 'year', minor: null, step: 1 });
		expect(axisSpec(1.2)).toMatchObject({ major: 'year', minor: 'month', step: 1 });
		expect(axisSpec(0.6)).toMatchObject({ major: 'year', minor: 'month', step: 2 });
		expect(axisSpec(2)).toMatchObject({ major: 'month', minor: 'week', step: 2 });
		expect(axisSpec(4)).toMatchObject({ major: 'month', minor: 'week', step: 1 });
		expect(axisSpec(1.7)).toMatchObject({ major: 'month', minor: 'week', step: 4 });
		expect(axisSpec(10)).toMatchObject({ major: 'month', middle: 'week', minor: 'day', step: 5 });
		expect(axisSpec(18)).toMatchObject({ minor: 'day', step: 5 });
		expect(axisSpec(30)).toMatchObject({ minor: 'day', step: 1, weekdays: false });
		expect(axisSpec(50)).toMatchObject({ minor: 'day', step: 1, weekdays: true });
	});
});

describe('axisTicks', () => {
	it('anchors day steps to the calendar, not to the window edge', () => {
		const spec = axisSpec(10);
		const context = { spec, ppd: 10 };
		const a = axisTicks({ start: D(2026, 8, 3), end: D(2026, 9, 2) }, 'day', spec.step, context);
		const b = axisTicks({ start: D(2026, 8, 7), end: D(2026, 9, 6) }, 'day', spec.step, context);
		const labelsA = a
			.filter((t) => t.start >= D(2026, 8, 7) && t.start < D(2026, 9, 2))
			.map((t) => t.label);
		const labelsB = b
			.filter((t) => t.start >= D(2026, 8, 7) && t.start < D(2026, 9, 2))
			.map((t) => t.label);
		expect(labelsA).toEqual(labelsB);
		expect(labelsA).toEqual(['10', '15', '20', '25', '1']);
	});

	it('labels the minor month row without the year and the major month row with it only in January', () => {
		const yearScale = { spec: axisSpec(1), ppd: 1 };
		const minor = axisTicks({ start: D(2025, 12, 15), end: D(2026, 2, 15) }, 'month', 1, yearScale);
		expect(minor.map((t) => t.label)).toEqual(['дек', 'янв', 'фев']);

		const monthScale = { spec: axisSpec(3), ppd: 3 };
		const major = axisTicks(
			{ start: D(2025, 12, 15), end: D(2026, 2, 15) },
			'month',
			1,
			monthScale
		);
		expect(major.map((t) => t.label)).toEqual(['дек', 'янв 2026', 'фев']);
	});

	it('labels weeks by ISO number, adding the Monday date only when there is room', () => {
		const tight = { spec: axisSpec(2), ppd: 2 };
		const wide = { spec: axisSpec(6), ppd: 6 };
		const window = { start: D(2026, 8, 31), end: D(2026, 9, 14) };
		expect(axisTicks(window, 'week', tight.spec.step, tight).map((t) => t.label)).toEqual([
			'н36',
			'н38'
		]);
		expect(axisTicks(window, 'week', wide.spec.step, wide).map((t) => t.label)).toEqual([
			'н36',
			'н37',
			'н38'
		]);
	});

	it('adds weekdays on the deepest scale', () => {
		const context = { spec: axisSpec(60), ppd: 60 };
		const ticks = axisTicks({ start: D(2026, 9, 4), end: D(2026, 9, 6) }, 'day', 1, context);
		expect(ticks.map((t) => t.label)).toEqual(['пт 4', 'сб 5', 'вс 6']);
	});
});

describe('axisRows and sticky label', () => {
	it('adds the week row only on the day scale', () => {
		const window = { start: D(2026, 8, 1), end: D(2026, 9, 1) };
		const rows = axisRows(window, 31 * 12);
		expect(rows.spec.minor).toBe('day');
		expect(rows.middle.length).toBeGreaterThan(3);
		const yearRows = axisRows({ start: D(2024, 1, 1), end: D(2027, 1, 1) }, 1100);
		expect(yearRows.middle).toEqual([]);
	});

	it('names the period under the left edge with the week when weeks are visible', () => {
		const window = { start: D(2026, 8, 20), end: D(2026, 9, 20) };
		const ppd = pxPerDay(window, 1100);
		expect(stickyLabel(window, axisSpec(ppd), ppd)).toBe('авг 2026 · н34');
		const yearWindow = { start: D(2025, 3, 10), end: D(2026, 3, 10) };
		const yearPpd = pxPerDay(yearWindow, 1100);
		expect(stickyLabel(yearWindow, axisSpec(yearPpd), yearPpd)).toBe('мар 2025 · н11');
		const farWindow = { start: D(2024, 3, 10), end: D(2027, 3, 10) };
		const farPpd = pxPerDay(farWindow, 1100);
		expect(stickyLabel(farWindow, axisSpec(farPpd), farPpd)).toBe('2024');
	});
});

describe('periodTitle', () => {
	it('reads in Russian for every unit', () => {
		expect(periodTitle(periodAt(D(2026, 4, 10), 'year'))).toBe('2026 год');
		expect(periodTitle(periodAt(D(2026, 4, 10), 'month'))).toBe('Апрель 2026');
		expect(periodTitle(periodAt(D(2026, 9, 9), 'week'))).toBe('Неделя 37 · 7 сен – 13 сен 2026');
		expect(periodTitle(periodAt(D(2026, 9, 4), 'day'))).toBe('4 сен 2026, пт');
	});

	it('keeps a day period exactly one day long', () => {
		const period = periodAt(D(2026, 9, 4) + 5000, 'day');
		expect(period.end - period.start).toBe(DAY_MS);
	});
});

describe('far calendar scales', () => {
	it('uses complete calendar decades for labels, selection and navigation', () => {
		const decade = periodAt(D(2026, 9, 1), 'decade');
		expect(decade).toEqual({ unit: 'decade', start: D(2020, 1, 1), end: D(2030, 1, 1) });
		expect(prevUnit(decade.start, 'decade')).toBe(D(2010, 1, 1));
		expect(periodTitle(decade)).toBe('2020-е годы');
	});
	it('removes months, then replaces years with decades as available room shrinks', () => {
		const years = axisRows({ start: D(2020, 1, 1), end: D(2025, 1, 1) }, 600);
		expect(years.spec.major).toBe('year');
		expect(years.minor).toEqual([]);
		const decades = axisRows({ start: D(1990, 1, 1), end: D(2030, 1, 1) }, 600);
		expect(decades.spec.major).toBe('decade');
		expect(decades.major.map((t) => t.label)).toEqual([
			'1990-е',
			'2000-е',
			'2010-е',
			'2020-е',
			'2030-е'
		]);
		expect(decades.minor).toEqual([]);
	});
	it('thins decade labels at a calendar-anchored step, accounting for enlarged text', () => {
		const window = { start: D(1990, 1, 1), end: D(2100, 1, 1) };
		const rows = axisRows(window, 320, 1.5);
		expect(rows.spec.step).toBe(5);
		for (let i = 1; i < rows.major.length; i++) {
			const spacing =
				((rows.major[i].start - rows.major[i - 1].start) / (window.end - window.start)) * 320;
			expect(spacing).toBeGreaterThan(64 * 1.5);
		}
		const shifted = axisRows({ start: D(1991, 1, 1), end: D(2101, 1, 1) }, 320, 1.5);
		expect(shifted.major.map((t) => t.start)).toEqual(rows.major.map((t) => t.start));
	});
});

it('thins week labels to every fourth ISO week when enlarged text leaves no room', () => {
	const window = { start: D(2026, 2, 18), end: D(2026, 10, 16) };
	const rows = axisRows(window, 600, 1.5);
	expect(rows.spec).toMatchObject({ major: 'month', minor: 'week', step: 4 });
	expect(rows.minor.length).toBeGreaterThan(3);
	for (const tick of rows.minor) expect(isoWeek(tick.start) % 4).toBe(0);
	expect(axisRows(window, 600).spec.step).toBe(2);
});
