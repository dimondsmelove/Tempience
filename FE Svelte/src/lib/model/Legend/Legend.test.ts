import { describe, expect, it } from 'vitest';
import { LEGEND_KEYS } from './constants';
import {
	legendFollows,
	legendKeysOf,
	legendShown,
	listedLegendKeys,
	type LegendMarkInput
} from './Legend';
import type { LegendKey } from './types';

const NOW = Date.UTC(2026, 8, 6, 12);
const DAY = 24 * 60 * 60 * 1000;

const mark = (patch: Partial<LegendMarkInput> = {}): LegendMarkInput => ({
	kind: 'moment',
	intent: false,
	rollup: false,
	end: NOW + DAY,
	...patch
});
const keys = (patch: Partial<LegendMarkInput> = {}): LegendKey[] => legendKeysOf(mark(patch), NOW);

describe('legendKeysOf — every row of the vocabulary', () => {
	it('a fact is a fact, an interval an interval, a fuzzy date a fuzzy date', () => {
		expect(keys()).toEqual(['fact']);
		expect(keys({ kind: 'interval' })).toEqual(['interval']);
		expect(keys({ kind: 'fuzzy' })).toEqual(['fuzzy']);
	});

	it('an open interval («длится») is open and an interval, and never overdue; an open intention stays «намерение»', () => {
		expect(keys({ kind: 'interval', open: true, end: NOW })).toEqual(['open', 'interval']);
		// The start still ahead: the head alone on the ribbon, the same kinds in the legend.
		expect(keys({ kind: 'interval', open: true, end: NOW + DAY })).toEqual(['open', 'interval']);
		expect(keys({ kind: 'interval', open: true, intent: true, end: NOW })).toEqual(['intent']);
		expect(keys({ kind: 'fuzzy', open: true, end: NOW })).toEqual(['fuzzy']);
	});

	it('«намерение» is every open intention; one whose window ended before «сейчас» is overdue too', () => {
		expect(keys({ intent: true })).toEqual(['intent']);
		expect(keys({ intent: true, end: NOW - DAY })).toEqual(['intent', 'overdue']);
		// A day-precision moment sits at midday, but its window is the whole day (п. 11).
		expect(keys({ intent: true, end: NOW - 60_000, until: NOW + 60_000 })).toEqual(['intent']);
		expect(keys({ intent: true, end: NOW - 60_000, until: NOW - 1 })).toEqual([
			'intent',
			'overdue'
		]);
	});

	it('a closed intention is «закрытое» and «намерение» both (owner 2026-09-19, L1), and never overdue', () => {
		expect(keys({ intent: true, closed: true })).toEqual(['closed', 'intent']);
		expect(keys({ intent: true, closed: true, end: NOW - DAY })).toEqual(['closed', 'intent']);
	});

	it('a fuzzy intention is that and an intention; closed, it is that, closed and an intention', () => {
		expect(keys({ kind: 'fuzzy', intent: true })).toEqual(['fuzzyIntent', 'intent']);
		expect(keys({ kind: 'fuzzy', intent: true, end: NOW - DAY })).toEqual([
			'fuzzyIntent',
			'intent',
			'overdue'
		]);
		expect(keys({ kind: 'fuzzy', intent: true, closed: true })).toEqual([
			'fuzzyIntent',
			'closed',
			'intent'
		]);
	});

	it('a proposal is only a proposal, whatever it would become', () => {
		expect(keys({ proposal: true })).toEqual(['proposal']);
		expect(keys({ proposal: true, intent: true, end: NOW - DAY })).toEqual(['proposal']);
		expect(keys({ proposal: true, kind: 'interval' })).toEqual(['proposal']);
	});

	it('a roll-up and a record in several Scopes are additive kinds', () => {
		expect(keys({ rollup: true })).toEqual(['rollup', 'fact']);
		expect(keys({ multi: true, kind: 'interval' })).toEqual(['multi', 'interval']);
		expect(keys({ rollup: true, multi: true, intent: true, end: NOW - DAY })).toEqual([
			'rollup',
			'multi',
			'intent',
			'overdue'
		]);
	});

	it('every key of the vocabulary but «длится» is reachable today; «длится» waits for C5', () => {
		const reached = new Set<LegendKey>([
			...keys(),
			...keys({ kind: 'interval' }),
			...keys({ kind: 'fuzzy' }),
			...keys({ intent: true, end: NOW - DAY }),
			...keys({ intent: true, closed: true }),
			...keys({ kind: 'fuzzy', intent: true }),
			...keys({ proposal: true }),
			...keys({ rollup: true, multi: true })
		]);
		expect(LEGEND_KEYS.filter((key) => !reached.has(key))).toEqual(['open']);
	});
});

describe('legendShown — solo wins over hidden while set', () => {
	const none = { soloLegend: null, hiddenLegend: new Set<LegendKey>() };

	it('without a filter everything is shown', () => {
		expect(legendShown(['fact'], none)).toBe(true);
		expect(legendShown(['rollup', 'intent', 'overdue'], none)).toBe(true);
	});

	it('a hidden kind takes every mark that answers to it, whatever else it is', () => {
		const filter = { ...none, hiddenLegend: new Set<LegendKey>(['rollup']) };
		expect(legendShown(['rollup', 'fact'], filter)).toBe(false);
		expect(legendShown(['fact'], filter)).toBe(true);
		expect(legendShown(['rollup', 'intent'], { ...none, hiddenLegend: new Set(['intent']) })).toBe(
			false
		);
	});

	it('solo keeps only the marks answering to it and ignores the hidden set meanwhile', () => {
		const filter = { soloLegend: 'intent' as const, hiddenLegend: new Set<LegendKey>(['intent']) };
		expect(legendShown(['intent', 'overdue'], filter)).toBe(true);
		expect(legendShown(['rollup', 'intent'], filter)).toBe(true);
		expect(legendShown(['fact'], filter)).toBe(false);
		expect(legendShown(['fuzzyIntent', 'fuzzy'], filter)).toBe(false);
	});

	it('L1: solo «намерение» keeps a closed intention, hiding «намерение» hides it, solo «закрытое» shows the closed alone', () => {
		const closed = keys({ intent: true, closed: true });
		const open = keys({ intent: true });
		expect(legendShown(closed, { ...none, soloLegend: 'intent' })).toBe(true);
		expect(legendShown(closed, { ...none, hiddenLegend: new Set<LegendKey>(['intent']) })).toBe(
			false
		);
		expect(legendShown(closed, { ...none, soloLegend: 'closed' })).toBe(true);
		expect(legendShown(open, { ...none, soloLegend: 'closed' })).toBe(false);
		expect(legendShown(open, { ...none, hiddenLegend: new Set<LegendKey>(['closed']) })).toBe(true);
	});
});

describe('legendFollows — the closing fact follows its intention (loop 008, C4)', () => {
	const none = { soloLegend: null, hiddenLegend: new Set<LegendKey>() };
	const fact = keys();
	const result = legendFollows({ result: true });

	it('a result follows «намерение» and «закрытое намерение»; any other mark follows nothing', () => {
		expect(result).toEqual(['intent', 'closed']);
		expect(legendFollows({})).toEqual([]);
		expect(legendFollows({ result: false })).toEqual([]);
	});

	it('solo «намерение» and solo «закрытое» keep the result; solo «интервал» does not', () => {
		expect(legendShown(fact, { ...none, soloLegend: 'intent' }, result)).toBe(true);
		expect(legendShown(fact, { ...none, soloLegend: 'closed' }, result)).toBe(true);
		expect(legendShown(fact, { ...none, soloLegend: 'interval' }, result)).toBe(false);
		// The same fact without the result flag leaves under either solo.
		expect(legendShown(fact, { ...none, soloLegend: 'intent' })).toBe(false);
		expect(legendShown(fact, { ...none, soloLegend: 'closed' }, legendFollows({}))).toBe(false);
	});

	it('it is still a fact: solo «факт» keeps it, hiding «намерение» or «закрытое» leaves it, hiding «факт» takes it', () => {
		expect(legendShown(fact, { ...none, soloLegend: 'fact' }, result)).toBe(true);
		expect(
			legendShown(fact, { ...none, hiddenLegend: new Set<LegendKey>(['intent']) }, result)
		).toBe(true);
		expect(
			legendShown(fact, { ...none, hiddenLegend: new Set<LegendKey>(['closed']) }, result)
		).toBe(true);
		expect(legendShown(fact, { ...none, hiddenLegend: new Set<LegendKey>(['fact']) }, result)).toBe(
			false
		);
	});
});

describe('listedLegendKeys — present kinds only, plus what can be undone', () => {
	it('lists the present kinds in the vocabulary order', () => {
		const present = new Set<LegendKey>(['multi', 'fact', 'intent']);
		expect(
			listedLegendKeys(present, { soloLegend: null, hiddenLegend: new Set<LegendKey>() })
		).toEqual(['fact', 'intent', 'multi']);
	});

	it('keeps a hidden or soloed kind listed when its marks are gone from the view', () => {
		const present = new Set<LegendKey>(['fact']);
		expect(
			listedLegendKeys(present, { soloLegend: null, hiddenLegend: new Set<LegendKey>(['rollup']) })
		).toEqual(['fact', 'rollup']);
		expect(
			listedLegendKeys(present, { soloLegend: 'proposal', hiddenLegend: new Set<LegendKey>() })
		).toEqual(['fact', 'proposal']);
		expect(listedLegendKeys(new Set(), { soloLegend: null, hiddenLegend: new Set() })).toEqual([]);
	});
});
