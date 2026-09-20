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
	tickLabel,
	unitBoundaries
} from './Axis';
import { DAY_MS, LABEL_PADDING_PX } from './constants';

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
		expect(axisSpec(0.2)).toMatchObject({ band: 'years', major: 'year', minor: null, step: 1 });
		expect(axisSpec(1.2)).toMatchObject({ band: 'months', major: 'year', minor: 'month', step: 1 });
		expect(axisSpec(0.6)).toMatchObject({ major: 'year', minor: 'month', step: 2 });
		expect(axisSpec(2)).toMatchObject({ band: 'weeks', major: 'month', minor: 'week', step: 4 });
		expect(axisSpec(4)).toMatchObject({ major: 'month', minor: 'week', step: 2 });
		expect(axisSpec(5)).toMatchObject({ major: 'month', minor: 'week', step: 1 });
		expect(axisSpec(1.7)).toMatchObject({ major: 'month', minor: 'week', step: 4 });
		expect(axisSpec(10)).toMatchObject({ band: 'days', middle: 'week', minor: 'day', step: 5 });
		expect(axisSpec(18)).toMatchObject({ minor: 'day', step: 5 });
		expect(axisSpec(30)).toMatchObject({ minor: 'day', step: 1, weekdays: false });
		expect(axisSpec(50)).toMatchObject({ band: 'weekdays', minor: 'day', step: 1, weekdays: true });
	});

	it('chooses the step by the measured width of the widest label plus paddings', () => {
		// «н10…н52» at 2.2 px/day: a 21 px label needs 33 px, a week is 15.4 px, two weeks 30.8.
		const weeks = axisSpec(2.2, { widths: { week: 21 } });
		expect(weeks).toMatchObject({ band: 'weeks', minor: 'week', step: 4 });
		expect(weeks.step * 7 * 2.2).toBeGreaterThanOrEqual(21 + LABEL_PADDING_PX);
		expect(2 * 7 * 2.2).toBeLessThan(21 + LABEL_PADDING_PX);
		expect(axisSpec(2.2, { widths: { week: 12 } }).step).toBe(2);
		expect(axisSpec(0.5, { widths: { month: 21 } })).toMatchObject({ minor: 'month', step: 3 });
		expect(axisSpec(0.5, { widths: { month: 14 } }).step).toBe(2);
		expect(axisSpec(20, { widths: { day: 14 } }).step).toBe(5);
		expect(axisSpec(26, { widths: { day: 14 } }).step).toBe(1);
		expect(axisSpec(0.005, { widths: { decade: 42 } })).toMatchObject({ major: 'decade', step: 5 });
	});

	it('gives days their weekday only once a day fits «пн 31»', () => {
		expect(axisSpec(44, { widths: { weekday: 35 } })).toMatchObject({ band: 'days', step: 1 });
		expect(axisSpec(48, { widths: { weekday: 35 } })).toMatchObject({ band: 'weekdays', step: 1 });
	});

	it('holds the previous band within 4 % of a threshold', () => {
		expect(axisSpec(1.63, { previous: 'months' }).band).toBe('months');
		expect(axisSpec(1.67, { previous: 'months' }).band).toBe('weeks');
		expect(axisSpec(1.57, { previous: 'weeks' }).band).toBe('weeks');
		expect(axisSpec(1.53, { previous: 'weeks' }).band).toBe('months');
		expect(axisSpec(1.57).band).toBe('months');
		expect(axisSpec(1.63, { previous: 'days' }).band).toBe('weeks');
		expect(axisSpec(7.2, { previous: 'weeks' })).toMatchObject({ band: 'weeks', step: 1 });
		expect(axisSpec(6.8, { previous: 'days' })).toMatchObject({ band: 'days', step: 5 });
	});

	it('scales the thresholds and the baseline widths with the text', () => {
		expect(axisSpec(2, { textScale: 1.5 }).band).toBe('months');
		expect(axisSpec(2.5, { textScale: 1.5 })).toMatchObject({ band: 'weeks', step: 4 });
		expect(axisSpec(2.5, { textScale: 1.5, widths: { week: 21 } }).step).toBe(2);
	});
});

describe('axisTicks', () => {
	it('lists every cell of the row and marks the ones on the step', () => {
		const spec = axisSpec(0.5);
		const ticks = axisTicks({ start: D(2026, 1, 1), end: D(2026, 7, 1) }, 'month', spec.step, {
			spec
		});
		expect(ticks.map((t) => t.label)).toEqual(['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл']);
		expect(ticks.filter((t) => t.labelled).map((t) => t.label)).toEqual(['янв', 'апр', 'июл']);
		expect(unitBoundaries({ start: D(2026, 1, 1), end: D(2026, 7, 1) }, 'month')).toHaveLength(7);
	});

	it('anchors day steps to the calendar, not to the window edge', () => {
		const spec = axisSpec(10);
		const context = { spec };
		const labels = (window: { start: number; end: number }) =>
			axisTicks(window, 'day', spec.step, context)
				.filter((t) => t.labelled && t.start >= D(2026, 8, 7) && t.start < D(2026, 9, 2))
				.map((t) => t.label);
		const a = labels({ start: D(2026, 8, 3), end: D(2026, 9, 2) });
		const b = labels({ start: D(2026, 8, 7), end: D(2026, 9, 6) });
		expect(a).toEqual(b);
		expect(a).toEqual(['10', '15', '20', '25', '1']);
	});

	it('labels the minor month row without the year and the major month row with it only in January', () => {
		const yearScale = { spec: axisSpec(1) };
		const minor = axisTicks({ start: D(2025, 12, 15), end: D(2026, 2, 15) }, 'month', 1, yearScale);
		expect(minor.map((t) => t.label)).toEqual(['дек', 'янв', 'фев']);

		const monthScale = { spec: axisSpec(3) };
		const major = axisTicks(
			{ start: D(2025, 12, 15), end: D(2026, 2, 15) },
			'month',
			1,
			monthScale
		);
		expect(major.map((t) => t.label)).toEqual(['дек', 'янв 2026', 'фев']);
	});

	it('gives a month of the major row the year when the row asks for it', () => {
		const context = { spec: axisSpec(3) };
		expect(tickLabel(D(2026, 9, 1), 'month', context)).toBe('сен');
		expect(tickLabel(D(2026, 9, 1), 'month', context, true)).toBe('сен 2026');
		expect(tickLabel(D(2026, 1, 1), 'month', context, true)).toBe('янв 2026');
		expect(tickLabel(D(2026, 9, 1), 'month', { spec: axisSpec(1) }, true)).toBe('сен');
	});

	it('labels weeks by ISO number, adding the Monday date only when there is room', () => {
		const tight = { spec: axisSpec(2) };
		const wide = { spec: axisSpec(6) };
		const window = { start: D(2026, 8, 31), end: D(2026, 9, 14) };
		const labelled = (context: { spec: ReturnType<typeof axisSpec> }) =>
			axisTicks(window, 'week', context.spec.step, context)
				.filter((t) => t.labelled)
				.map((t) => t.label);
		expect(labelled(tight)).toEqual(['н36']);
		expect(labelled(wide)).toEqual(['н36', 'н37', 'н38']);
		const dated = { spec: axisSpec(6, { widths: { weekDate: 20 } }) };
		expect(labelled(dated)).toEqual(['н36 · 31', 'н37 · 7', 'н38 · 14']);
	});

	it('adds weekdays on the deepest scale', () => {
		const context = { spec: axisSpec(60) };
		const ticks = axisTicks({ start: D(2026, 9, 4), end: D(2026, 9, 6) }, 'day', 1, context);
		expect(ticks.map((t) => t.label)).toEqual(['пт 4', 'сб 5', 'вс 6']);
	});
});

describe('axisRows', () => {
	it('adds the week row only on the day scale', () => {
		const window = { start: D(2026, 8, 1), end: D(2026, 9, 1) };
		const rows = axisRows(window, 31 * 12);
		expect(rows.spec.minor).toBe('day');
		expect(rows.middle.length).toBeGreaterThan(3);
		const yearRows = axisRows({ start: D(2024, 1, 1), end: D(2027, 1, 1) }, 1100);
		expect(yearRows.middle).toEqual([]);
	});

	it('keeps every month of the minor row as a cell at far scales', () => {
		const rows = axisRows({ start: D(2024, 1, 1), end: D(2027, 1, 1) }, 815);
		expect(rows.spec).toMatchObject({ band: 'months', minor: 'month', step: 2 });
		expect(rows.minor).toHaveLength(37);
		expect(rows.minor.filter((t) => t.labelled)).toHaveLength(19);
		expect(rows.minor[1]).toMatchObject({ label: 'фев', labelled: false });
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
		const rows = axisRows(window, 320, { textScale: 1.5 });
		expect(rows.spec.step).toBe(5);
		const labelled = rows.major.filter((t) => t.labelled);
		for (let i = 1; i < labelled.length; i++) {
			const spacing =
				((labelled[i].start - labelled[i - 1].start) / (window.end - window.start)) * 320;
			expect(spacing).toBeGreaterThan(64 * 1.5);
		}
		const shifted = axisRows({ start: D(1991, 1, 1), end: D(2101, 1, 1) }, 320, { textScale: 1.5 });
		expect(shifted.major.filter((t) => t.labelled).map((t) => t.start)).toEqual(
			labelled.map((t) => t.start)
		);
	});
});

it('thins week labels to every fourth ISO week when enlarged text leaves no room', () => {
	const window = { start: D(2026, 2, 18), end: D(2026, 10, 16) };
	const rows = axisRows(window, 600, { textScale: 1.5 });
	expect(rows.spec).toMatchObject({ major: 'month', minor: 'week', step: 4 });
	const labelled = rows.minor.filter((t) => t.labelled);
	expect(labelled.length).toBeGreaterThan(3);
	for (const tick of labelled) expect(isoWeek(tick.start) % 4).toBe(0);
	expect(axisRows(window, 600).spec.step).toBe(2);
});
