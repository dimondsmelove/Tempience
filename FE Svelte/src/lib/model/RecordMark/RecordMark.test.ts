import { describe, expect, it } from 'vitest';
import { markPaint } from './RecordMark';

describe('markPaint', () => {
	it('paints one colour plainly, a 3 px capsule', () => {
		expect(markPaint('fact', ['red'], 'ink')).toMatchObject({
			head: 3,
			headFill: 'red',
			bandFill: null,
			woven: false
		});
	});
	it('paints no colour in ink', () => {
		expect(markPaint('fact', [], 'ink').headFill).toBe('ink');
	});
	it('weaves several colours in layers, a pixel wider, without repeats', () => {
		const paint = markPaint('fact', ['red', 'blue', 'red'], 'ink');
		expect(paint.head).toBe(4);
		expect(paint.woven).toBe(true);
		expect(paint.headFill).toBe('linear-gradient(180deg, red 0% 50%, blue 50% 100%)');
	});
	it('stripes an interval’s band when it has room for one of each, else layers it', () => {
		const two = markPaint('interval', ['red', 'blue'], 'ink');
		expect(two.band).toBe(12);
		expect(two.bandFill).toMatch(
			/^repeating-linear-gradient\(90deg, color-mix\(in oklab, red 30%/u
		);
		const four = markPaint('interval', ['a', 'b', 'c', 'd'], 'ink');
		expect(four.bandFill).toMatch(/^linear-gradient\(180deg/u);
	});
	it('gives a vague window no head and dots an intention', () => {
		expect(markPaint('fuzzy', ['red'], 'ink')).toMatchObject({ head: 0, band: 16 });
		expect(markPaint('intent', ['red', 'blue'], 'ink').dotted).toBe(true);
	});
});
