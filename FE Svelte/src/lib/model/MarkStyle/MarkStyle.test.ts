import { describe, expect, it } from 'vitest';
import { markColours, markStyle, resolveColours, rowColours } from './MarkStyle';
import { scopeColour, type ScopeColour } from '$lib/theme/scope-colour';
import type { MarkStyleInput } from './types';

const fact: MarkStyleInput = { kind: 'moment', intent: false, rollup: false, start: 0, end: 0 };
const plain = { selected: false };
const palette = { ink: 'ink', scope: (colour: ScopeColour) => `s${colour.hue}` };
const c = (hue: number, chroma: number | null = null): ScopeColour => ({ hue, chroma });

describe('markStyle: the mark language without frames', () => {
	it('a fact is a solid capsule in full force', () => {
		expect(markStyle(fact, plain)).toEqual({
			alpha: 0.9,
			span: false,
			band: null,
			capsule: 1,
			tick: false,
			hollow: false,
			ring: false
		});
	});

	it('an interval is a 30 % band with a solid head', () => {
		const style = markStyle({ ...fact, kind: 'interval' }, plain);
		expect(style).toMatchObject({ span: true, band: 0.3, capsule: 1, tick: false, hollow: false });
	});

	it('an open interval is the band with its head; one whose start lies ahead is the head alone', () => {
		const open = markStyle({ ...fact, kind: 'interval', open: true, start: 0, end: 10 }, plain);
		expect(open).toMatchObject({ span: true, band: 0.3, capsule: 1, tick: false, hollow: false });
		const ahead = markStyle({ ...fact, kind: 'interval', open: true, start: 10, end: 10 }, plain);
		expect(ahead).toMatchObject({ span: false, band: null, capsule: 1, tick: false });
		const intent = markStyle(
			{ ...fact, kind: 'interval', open: true, intent: true, start: 10, end: 10 },
			plain
		);
		expect(intent).toMatchObject({ span: false, band: null, capsule: null, tick: true });
	});

	it('a fuzzy date is the band of its window with no head', () => {
		const style = markStyle({ ...fact, kind: 'fuzzy' }, plain);
		expect(style).toMatchObject({ span: true, band: 0.3, capsule: null, tick: false });
	});

	it('an open intention is a dotted tick alone; overdue is not marked apart', () => {
		const style = markStyle({ ...fact, intent: true }, plain);
		expect(style).toMatchObject({
			band: null,
			capsule: null,
			tick: true,
			hollow: false,
			alpha: 0.9
		});
	});

	it('a closed intention keeps the tick over a 45 % capsule; the outcome is not on the ribbon', () => {
		const style = markStyle({ ...fact, intent: true, closed: true }, plain);
		expect(style).toMatchObject({ band: null, capsule: 0.45, tick: true, alpha: 0.9 });
	});

	it('a fuzzy intention is the band with the tick at the window start', () => {
		const style = markStyle({ ...fact, kind: 'fuzzy', intent: true }, plain);
		expect(style).toMatchObject({ span: true, band: 0.3, capsule: null, tick: true });
	});

	it('an interval intention composes the band with the tick as its head', () => {
		const style = markStyle({ ...fact, kind: 'interval', intent: true }, plain);
		expect(style).toMatchObject({ span: true, band: 0.3, capsule: null, tick: true });
	});

	it('a proposal is a hollow contour of the silhouette it would get, whatever else it is', () => {
		expect(markStyle({ ...fact, proposal: true }, plain)).toMatchObject({
			span: false,
			band: null,
			capsule: null,
			tick: false,
			hollow: true
		});
		expect(
			markStyle({ ...fact, kind: 'interval', intent: true, proposal: true }, plain)
		).toMatchObject({ span: true, hollow: true, tick: false, band: null });
	});

	it('a roll-up is the one dimness, 30 %, and keeps its shape', () => {
		expect(markStyle({ ...fact, rollup: true }, plain)).toMatchObject({ alpha: 0.3, capsule: 1 });
		expect(markStyle({ ...fact, kind: 'interval', rollup: true }, plain)).toMatchObject({
			alpha: 0.3,
			band: 0.3
		});
	});

	it('selection is a ring and full force, never a recolour; it outranks the roll-up dimness', () => {
		const selected = { selected: true };
		expect(markStyle(fact, selected)).toMatchObject({ alpha: 1, ring: true, capsule: 1 });
		expect(markStyle({ ...fact, rollup: true }, selected)).toMatchObject({ alpha: 1, ring: true });
		expect(markStyle({ ...fact, intent: true, closed: true }, selected)).toMatchObject({
			alpha: 1,
			ring: true,
			capsule: 0.45,
			tick: true
		});
	});

	it('a lit record draws in full force without the ring, a lit roll-up included (п. 5)', () => {
		const lit = { selected: false, lit: true };
		expect(markStyle(fact, lit)).toMatchObject({ alpha: 1, ring: false });
		expect(markStyle({ ...fact, rollup: true }, lit)).toMatchObject({ alpha: 1, ring: false });
	});
});

describe('resolveColours: colour comes from the Scope colour pairs through the mode rule, ink when there is none', () => {
	it('maps pairs to colours in order, without repeats', () => {
		expect(resolveColours([c(2), c(1), c(2)], palette)).toEqual(['s2', 's1']);
		// Two pairs of one colour (the rule's resolution) weave as one.
		expect(resolveColours([c(1), c(2)], { ink: 'ink', scope: () => 'same' })).toEqual(['same']);
	});

	it('is ink for no colour or a null one', () => {
		expect(resolveColours([], palette)).toEqual(['ink']);
		expect(resolveColours([null, undefined], palette)).toEqual(['ink']);
	});

	it('resolves a real palette: the colour rule of the mode, dark and light apart, saturation heard', () => {
		const rule = (mode: 'dark' | 'light') => (colour: ScopeColour) =>
			scopeColour(colour.hue, colour.chroma, mode);
		const dark = { ink: '#fff', scope: rule('dark') };
		const light = { ink: '#000', scope: rule('light') };
		expect(resolveColours([c(267)], dark)).toEqual([scopeColour(267, null, 'dark')]);
		expect(resolveColours([c(267)], light)).toEqual([scopeColour(267, null, 'light')]);
		expect(resolveColours([c(267)], dark)).not.toEqual(resolveColours([c(267)], light));
		expect(resolveColours([c(267, 30)], dark)).toEqual([scopeColour(267, 30, 'dark')]);
		expect(resolveColours([c(267, 30)], dark)).not.toEqual(resolveColours([c(267)], dark));
		expect(resolveColours([c(267), c(90)], dark)).toEqual([
			scopeColour(267, null, 'dark'),
			scopeColour(90, null, 'dark')
		]);
	});

	it('a row of one Scope paints with that Scope, colourless rows with ink', () => {
		expect(rowColours({ colours: [c(3)] }, palette)).toEqual(['s3']);
		expect(rowColours({ colours: [] }, palette)).toEqual(['ink']);
		// A merged row: the mark's own member colours win over the row's; two members weave, one paints.
		expect(markColours({ colours: [c(3), c(1)] }, { colours: [c(1), c(3)] }, palette)).toEqual([
			's1',
			's3'
		]);
		expect(markColours({ colours: [c(3), c(1)] }, { colours: [c(3)] }, palette)).toEqual(['s3']);
		expect(markColours({ colours: [c(3), c(1)] }, { colours: [] }, palette)).toEqual(['ink']);
		expect(markColours({ colours: [c(3)] }, {}, palette)).toEqual(['s3']);
	});
});
