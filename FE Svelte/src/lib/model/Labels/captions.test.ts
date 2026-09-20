import { describe, expect, it } from 'vitest';
import type { Mark } from '$lib/model/Projection/types';
import { placeLabels } from './Labels';
import { emphasisOf, resolveCaptions } from './captions';
import type { CaptionOptions, MarkBox } from './types';

const mark = (id: string, label: string, rollup = false, patch: Partial<Mark> = {}): Mark => ({
	id: `${id}@r`,
	traceId: id,
	rowId: 'r',
	kind: 'moment',
	intent: false,
	rollup,
	start: 0,
	end: 0,
	label,
	timeLabel: '',
	precision: 'day',
	certainty: 'exact',
	...patch
});
const box = (
	id: string,
	label: string,
	x0: number,
	x1: number,
	track = 0,
	patch: Partial<Mark> = {}
): MarkBox => ({
	mark: mark(id, label, false, patch),
	track,
	x0,
	x1,
	y0: track < 0 ? 44 : 10,
	y1: track < 0 ? 47 : 26
});
const measure = (text: string): number => text.length * 6;
const none: ReadonlySet<string> = new Set();
const base: CaptionOptions = {
	selectedTraceId: null,
	lit: none,
	dimmed: none,
	searching: false,
	measure,
	fontPx: 12,
	widthPx: 1000
};
/** «a» and «b» are too close for both captions; «c» stands alone far right. */
const boxes = [box('a', 'abcde', 0, 8), box('b', 'xy', 26, 34), box('c', 'zz', 300, 308)];
const row = (options: CaptionOptions) => ({
	boxes,
	labels: placeLabels(boxes, { ...base, selectedTraceId: options.selectedTraceId }),
	y0: 0,
	y1: 52
});
const texts = (options: CaptionOptions) =>
	resolveCaptions(row(options), options).map((caption) => [
		caption.label.text,
		caption.strong,
		caption.backing,
		caption.alpha
	]);

describe('resolveCaptions — a forced caption says what the record has to say in full (C4)', () => {
	/** «c» is a closed intention with a known closing: its forced caption adds the day. */
	const closedBoxes = [
		box('a', 'abcde', 0, 8),
		box('c', '○ zz', 300, 308, 0, {
			intent: true,
			closed: true,
			closedAt: 1,
			forcedLabel: '○ zz · ✓ 6 сен'
		})
	];
	const closedRow = (options: CaptionOptions) => ({
		boxes: closedBoxes,
		labels: placeLabels(closedBoxes, { ...base, selectedTraceId: options.selectedTraceId }),
		y0: 0,
		y1: 52
	});
	const textOf = (options: CaptionOptions, id: string) =>
		resolveCaptions(closedRow(options), options).find((caption) => caption.label.markId === id)
			?.label;

	it('at rest the caption is the label; selected, lit or matched it is the forced label, measured as such', () => {
		expect(textOf(base, 'c@r')).toMatchObject({ text: '○ zz', width: 24 });
		expect(textOf({ ...base, selectedTraceId: 'c' }, 'c@r')).toMatchObject({
			text: '○ zz · ✓ 6 сен',
			width: measure('○ zz · ✓ 6 сен')
		});
		expect(textOf({ ...base, lit: new Set(['c']) }, 'c@r')).toMatchObject({
			text: '○ zz · ✓ 6 сен'
		});
		expect(textOf({ ...base, searching: true }, 'c@r')).toMatchObject({ text: '○ zz · ✓ 6 сен' });
		// A record without a forced label reads its label when forced, as before.
		expect(textOf({ ...base, selectedTraceId: 'a' }, 'a@r')).toMatchObject({ text: 'abcde' });
	});

	it('the forced label is the text when the emphasis adds a caption the layout left out', () => {
		// «c» has no room before «a» in its track, so it has no caption at rest.
		const tight = [
			box('c', '○ zz', 0, 8, 0, { intent: true, closed: true, forcedLabel: '○ zz · ✓ 6 сен' }),
			box('a', 'abcde', 26, 34)
		];
		const rowTight = {
			boxes: tight,
			labels: placeLabels(tight, { ...base, selectedTraceId: null }),
			y0: 0,
			y1: 52
		};
		expect(rowTight.labels.map((label) => label.markId)).toEqual(['a@r']);
		const lit = resolveCaptions(rowTight, { ...base, lit: new Set(['c']) });
		expect(lit.find((caption) => caption.label.markId === 'c@r')).toMatchObject({
			label: { text: '○ zz · ✓ 6 сен', width: measure('○ zz · ✓ 6 сен') },
			strong: true
		});
	});
});

describe('emphasisOf', () => {
	it('the selected and the lit record are strong and forced; a match is forced only', () => {
		expect(emphasisOf('a', { ...base, selectedTraceId: 'a' })).toEqual({
			strong: true,
			forced: true,
			dim: false
		});
		expect(emphasisOf('a', { ...base, lit: new Set(['a']) })).toEqual({
			strong: true,
			forced: true,
			dim: false
		});
		expect(emphasisOf('a', { ...base, searching: true })).toEqual({
			strong: false,
			forced: true,
			dim: false
		});
		expect(emphasisOf('a', base)).toEqual({ strong: false, forced: false, dim: false });
	});

	it('a record the search misses is dim, unless the pointer rests on it', () => {
		const dimmed = new Set(['a']);
		expect(emphasisOf('a', { ...base, searching: true, dimmed })).toEqual({
			strong: false,
			forced: false,
			dim: true
		});
		expect(emphasisOf('a', { ...base, searching: true, dimmed, lit: dimmed })).toMatchObject({
			strong: true,
			dim: false
		});
	});
});

describe('resolveCaptions: forced captions with a backing (п. 5, 9)', () => {
	it('without emphasis it repeats the layout: the hidden caption stays hidden, none needs a backing', () => {
		expect(texts(base)).toEqual([
			['xy', false, false, 1],
			['zz', false, false, 1]
		]);
	});

	it('the lit record gets its caption back, bold, on a backing where it runs into the neighbour', () => {
		expect(texts({ ...base, lit: new Set(['a']) })).toEqual([
			['xy', false, false, 1],
			['zz', false, false, 1],
			['abcde', true, true, 1]
		]);
	});

	it('the selected caption the layout placed over a neighbour also takes the backing', () => {
		const captions = resolveCaptions(row({ ...base, selectedTraceId: 'a' }), {
			...base,
			selectedTraceId: 'a'
		});
		const selected = captions.find((caption) => caption.label.text === 'abcde')!;
		expect(selected.strong).toBe(true);
		expect(selected.backing).toBe(true);
		// The lone caption far right is forced by nothing and covers nothing.
		expect(captions.find((caption) => caption.label.text === 'zz')!.backing).toBe(false);
	});

	it('a search forces the matches without bold and dims the rest to 18 %', () => {
		expect(texts({ ...base, searching: true, dimmed: new Set(['b', 'c']) })).toEqual([
			['xy', false, false, 0.18],
			['zz', false, false, 0.18],
			['abcde', false, true, 1]
		]);
	});

	it('forced captions never cover each other: the later one yields', () => {
		// Every record of the row is lit (a row hover); «a» and «b» want the same pixels.
		const captions = texts({ ...base, lit: new Set(['a', 'b', 'c']) });
		expect(captions.map((entry) => entry[0])).toEqual(['xy', 'zz']);
		expect(captions.every((entry) => entry[1] === true)).toBe(true);
	});

	it('among forced captions the earlier record wins, not the earlier caption: a moment inside a lit interval yields to it (loop 008 review)', () => {
		// The interval «course» (0–120) is captioned after its band at 129; the moment «offer» inside it
		// (at 80) is captioned at 89 — earlier on the canvas, later as a record. Both lit by a focus.
		const boxes = [box('course', 'course', 0, 120, 0), box('offer', 'offer', 80, 88, 1)];
		const row = { boxes, labels: [], y0: 0, y1: 52 };
		const focus = resolveCaptions(row, { ...base, lit: new Set(['course', 'offer']) });
		expect(focus.map((caption) => caption.label.text)).toEqual(['course']);
		// A search match, not bold, is a forced caption like any other: the earlier record still wins.
		const mixed = resolveCaptions(row, {
			...base,
			lit: new Set(['offer']),
			searching: true,
			dimmed: new Set()
		});
		expect(mixed.map((caption) => caption.label.text)).toEqual(['course']);
		// The selected record's caption is drawn always, whatever its start.
		const selected = resolveCaptions(row, {
			...base,
			selectedTraceId: 'offer',
			lit: new Set(['course'])
		});
		expect(selected.map((caption) => caption.label.text)).toEqual(['offer']);
	});

	it('a fuzzy date in a track is captioned after its band like any span; lit, it takes a backing over a neighbour', () => {
		const fuzzy = box('f', 'fuzzy', 0, 20, 1);
		const all = [...boxes, fuzzy];
		const layout = { boxes: all, labels: placeLabels(all, base), y0: 0, y1: 52 };
		// Its caption would run into «abcde»: the collision rule leaves it out.
		expect(resolveCaptions(layout, base).some((entry) => entry.label.text === 'fuzzy')).toBe(false);
		const captions = resolveCaptions(layout, { ...base, lit: new Set(['f']) });
		const caption = captions.find((entry) => entry.label.text === 'fuzzy')!;
		expect(caption.label).toMatchObject({ x: 29, y: 12 });
		expect(caption.strong).toBe(true);
		expect(caption.backing).toBe(true);
	});
});

describe('resolveCaptions: the budget, the tier and the cut yield to the emphasis (Q1-A)', () => {
	const long = 'Спроектировал n8n/Obsidian workflow для голосовых заметок с расшифровкой и тегами';
	const cut = 'Спроектировал n8n/Obsidian workflow для…';
	/** A «год» row, one track: a long-titled fact, a fact, an intention, each with room; only the intention is captioned at rest. */
	const year = [
		box('long', long, 0, 8, 0, { start: 1 }),
		box('fact', 'fact', 600, 608, 0, { start: 2 }),
		box('intent', 'intent', 800, 808, 0, { intent: true, start: 3 })
	];
	const yearRow = (selectedTraceId: string | null = null) => ({
		boxes: year,
		labels: placeLabels(year, { ...base, selectedTraceId, tier: 'year' }),
		y0: 0,
		y1: 52
	});
	const shown = (captions: ReturnType<typeof resolveCaptions>) =>
		captions.map((caption) => caption.label.text);

	it('at rest the row shows what the layout placed: the intention alone', () => {
		expect(shown(resolveCaptions(yearRow(), base))).toEqual(['intent']);
	});

	it('the lit fact gets its caption in full past the tier, bold; the selected too', () => {
		const lit = resolveCaptions(yearRow(), { ...base, lit: new Set(['long']) });
		expect(shown(lit)).toEqual(['intent', long]);
		expect(lit[1]).toMatchObject({ strong: true, backing: false });
		const selected = resolveCaptions(yearRow('long'), { ...base, selectedTraceId: 'long' });
		expect(shown(selected)).toEqual(['intent', long]);
		expect(selected[1].label.selected).toBe(true);
	});

	it('a search match bypasses the budget and the tier without bold', () => {
		const searched = resolveCaptions(yearRow(), {
			...base,
			searching: true,
			dimmed: new Set(['long', 'intent'])
		});
		expect(shown(searched)).toEqual(['intent', 'fact']);
		expect(searched[1]).toMatchObject({ strong: false, alpha: 1 });
		expect(searched[0].alpha).toBe(0.18);
	});

	it('a caption cut at rest reads in full while its record is lit or matched, on a plate where it runs into a neighbour', () => {
		// A «месяц» row: the long fact is captioned at rest, cut; «under» sits where the full text would run.
		const month = [
			box('long', long, 0, 8, 0, { start: 1 }),
			box('under', 'under', 300, 308, 0, { start: 2 })
		];
		const row = { boxes: month, labels: placeLabels(month, base), y0: 0, y1: 52 };
		expect(row.labels.map((label) => label.text)).toEqual([cut, 'under']);
		expect(shown(resolveCaptions(row, base))).toEqual([cut, 'under']);
		const lit = resolveCaptions(row, { ...base, lit: new Set(['long']) });
		const full = lit.find((caption) => caption.label.markId === 'long@r')!;
		expect(full.label.text).toBe(long);
		expect(full.label.width).toBe(measure(long));
		expect(full.backing).toBe(true);
		expect(full.strong).toBe(true);
		const matched = resolveCaptions(row, { ...base, searching: true, dimmed: new Set(['under']) });
		expect(matched.find((caption) => caption.label.markId === 'long@r')!.label.text).toBe(long);
	});

	it('a hover on the row name lights every record: all captions in full; the ones placed at rest keep their place, a later one yields', () => {
		// The row's records lit at once, as `litSet` does for a row hover; «near» is captioned at rest right of the cut text.
		const near = box('near', 'near', 300, 308, 0, { start: 5 });
		const boxes = [...year, near];
		const row = {
			boxes,
			labels: placeLabels(boxes, { ...base, tier: 'month' }),
			y0: 0,
			y1: 52
		};
		expect(row.labels.map((label) => label.text)).toEqual([cut, 'near', 'fact', 'intent']);
		const all = resolveCaptions(row, { ...base, lit: new Set(['long', 'fact', 'intent', 'near']) });
		expect(all.every((caption) => caption.strong)).toBe(true);
		// The full text now covers the place of «near», which yields; the rest read in full, left to right.
		expect(shown(all)).toEqual([long, 'fact', 'intent']);
		// The full text runs over the neighbour's mark: a plate.
		expect(all[0].backing).toBe(true);
		expect(all[1].backing).toBe(false);
	});

	it('strong captions are measured in the bold font, the selected one the layout placed included', () => {
		const measureStrong = (text: string): number => text.length * 7;
		const lit = resolveCaptions(yearRow(), { ...base, measureStrong, lit: new Set(['long']) });
		expect(lit.find((caption) => caption.label.markId === 'long@r')!.label.width).toBe(
			measureStrong(long)
		);
		expect(lit.find((caption) => caption.label.markId === 'intent@r')!.label.width).toBe(
			measure('intent')
		);
		const selected = resolveCaptions(yearRow('intent'), {
			...base,
			measureStrong,
			selectedTraceId: 'intent'
		});
		expect(selected.find((caption) => caption.label.markId === 'intent@r')!.label.width).toBe(
			measureStrong('intent')
		);
	});

	it('forced captions keep a plate apart: a later one whose plate would touch the text before it yields', () => {
		// The text of «second» starts 4 px after the end of «first» (12 + 30 = 42): text clear, plates not.
		const boxes = [
			box('first', 'first', 0, 8, 0, { start: 1 }),
			box('second', 'second', 34, 42, 0)
		];
		const row = { boxes, labels: [], y0: 0, y1: 52 };
		const both = resolveCaptions(row, { ...base, lit: new Set(['first', 'second']) });
		expect(shown(both)).toEqual(['first']);
		// 8 px after: the plates meet and nothing is covered.
		const apart = [boxes[0], box('second', 'second', 38, 46, 0)];
		expect(
			shown(
				resolveCaptions({ ...row, boxes: apart }, { ...base, lit: new Set(['first', 'second']) })
			)
		).toEqual(['first', 'second']);
	});

	it('a roll-up gets no caption at rest; a row hover, which lights roll-ups too, reveals it', () => {
		const rollup: MarkBox = { ...box('r', 'rolled', 520, 528, 0), mark: mark('r', 'rolled', true) };
		const boxes = [...year, rollup];
		const row = { boxes, labels: placeLabels(boxes, { ...base, tier: 'month' }), y0: 0, y1: 52 };
		expect(row.labels.map((label) => label.markId)).toEqual(['long@r', 'fact@r', 'intent@r']);
		const all = resolveCaptions(row, { ...base, lit: new Set(['long', 'fact', 'intent', 'r']) });
		expect(shown(all).toSorted()).toEqual([long, 'fact', 'intent', 'rolled'].toSorted());
	});
});
