import { describe, expect, it } from 'vitest';
import { canonicalData, jsonData, sameData } from './json';

describe('typed data as JSON', () => {
	it('omits cleared optional properties, nested too, and keeps explicit values', () => {
		expect(
			jsonData({
				optionalNumber: undefined,
				zero: 0,
				off: false,
				none: null,
				empty: '',
				nested: { gone: undefined, kept: 'x', deeper: { gone: undefined } },
				list: [0, null, false, '', { gone: undefined, kept: 1 }]
			})
		).toEqual({
			ok: true,
			value: {
				zero: 0,
				off: false,
				none: null,
				empty: '',
				nested: { kept: 'x', deeper: {} },
				list: [0, null, false, '', { kept: 1 }]
			}
		});
		expect(jsonData(undefined)).toEqual({ ok: true, value: {} });
	});

	it('reports an unfinished array item instead of turning it into null', () => {
		expect(jsonData({ list: [1, undefined, 3] })).toEqual({ ok: false, path: '/list/1' });
		expect(jsonData({ rows: [{ amount: [undefined] }] })).toEqual({
			ok: false,
			path: '/rows/0/amount/0'
		});
		expect(jsonData([1])).toEqual({ ok: false, path: '' });
	});

	it('keeps every own key of a document, including `__proto__` and `constructor`, nested too', () => {
		// JSON.parse creates own properties; an object literal `__proto__:` would not.
		const input = JSON.parse(
			'{"payload":{"__proto__":{"label":"kept"},"constructor":"ordinary","normal":1},"__proto__":[1]}'
		) as Record<string, unknown>;
		const read = jsonData(input);
		expect(read.ok).toBe(true);
		const value = (read as { value: Record<string, unknown> }).value;
		expect(Object.hasOwn(value, '__proto__')).toBe(true);
		expect(Object.hasOwn(value.payload as object, '__proto__')).toBe(true);
		expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
		expect(Object.getPrototypeOf(value.payload)).toBe(Object.prototype);
		expect(JSON.stringify(value)).toBe(JSON.stringify(input));
		expect(canonicalData(input)).toBe(
			'{"__proto__":[1],"payload":{"__proto__":{"label":"kept"},"constructor":"ordinary","normal":1}}'
		);
		expect(sameData(JSON.parse('{"__proto__":1}'), {})).toBe(false);
	});

	it('compares as the JSON that would be stored: key order free, array order kept', () => {
		expect(sameData({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
		expect(sameData({ optionalNumber: undefined }, {})).toBe(true);
		expect(sameData({ list: [1, 2] }, { list: [2, 1] })).toBe(false);
		expect(sameData({ list: [1, undefined] }, { list: [1, null] })).toBe(false);
		expect(canonicalData({ list: [1, undefined] })).toMatch(/^incomplete:\/list\/1:/);
		expect(sameData(null, {})).toBe(true);
	});
});
