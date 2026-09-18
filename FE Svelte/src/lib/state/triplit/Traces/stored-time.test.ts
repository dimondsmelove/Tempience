import { expect, it } from 'vitest';
import { parseTraceAboutTime } from '../trace-time';
import { projectStoredAboutTime, readStoredTraceData, readStoredTraceTime } from './stored-time';

const legacy = { aboutAt: null, aboutStart: null, aboutEnd: null };

it('drops only the other variants keys from a legacy stored aboutTime', () => {
	expect(
		projectStoredAboutTime({
			basis: 'unknown',
			precision: 'day',
			certainty: 'exact',
			start: '2026-09-11',
			end: null,
			anchorTraceId: 'a',
			relation: 'after'
		})
	).toEqual({ basis: 'unknown' });
	expect(
		projectStoredAboutTime({
			basis: 'absolute',
			precision: 'day',
			certainty: 'exact',
			start: '2026-09-11',
			end: null,
			anchorTraceId: 'a',
			relation: 'after'
		})
	).toEqual({
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	});
	expect(
		projectStoredAboutTime({
			basis: 'relative',
			precision: 'day',
			certainty: 'exact',
			start: '2026-09-11',
			anchorTraceId: 'a',
			relation: 'after'
		})
	).toEqual({ basis: 'relative', precision: 'day', anchorTraceId: 'a', relation: 'after' });
	// Unknown keys, unknown bases and non-objects are left for the strict parser to reject.
	expect(projectStoredAboutTime({ basis: 'unknown', extra: 1 })).toEqual({
		basis: 'unknown',
		extra: 1
	});
	expect(projectStoredAboutTime({ basis: 'later', start: 'x' })).toEqual({
		basis: 'later',
		start: 'x'
	});
	expect(projectStoredAboutTime('2026-09-11')).toBe('2026-09-11');
});

it('reads encoded values exactly and legacy values through the projection', () => {
	const stale = {
		basis: 'unknown',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	};
	expect(readStoredTraceTime({ id: 'l', aboutTime: stale }, 'instant', legacy)).toEqual({
		basis: 'unknown'
	});
	expect(
		readStoredTraceTime(
			{ id: 'e', aboutTime: [{ basis: 'unknown' }], encoding: { aboutTime: 1 } },
			'instant',
			legacy
		)
	).toEqual({ basis: 'unknown' });
	expect(
		readStoredTraceTime(
			{ id: 'n', aboutTime: [null], encoding: { aboutTime: 1 } },
			'trace_ref',
			legacy
		)
	).toBeNull();
	// An encoded value is never projected: stale keys inside it are corruption.
	expect(() =>
		readStoredTraceTime(
			{ id: 'c', aboutTime: [stale], encoding: { aboutTime: 1 } },
			'instant',
			legacy
		)
	).toThrow('unsupported fields');
	// Rows from before aboutTime existed still derive it from the exact projections.
	expect(
		readStoredTraceTime({ id: 'p' }, 'instant', {
			aboutAt: '2026-09-11T10:00:00.000Z',
			aboutStart: null,
			aboutEnd: null
		})
	).toMatchObject({ basis: 'absolute', precision: 'minute' });
});

it('reads typed data in both shapes and keeps legitimate nulls', () => {
	expect(readStoredTraceData({ id: 'l', data: { a: null, '0': { b: 1 } } })).toEqual({
		a: null,
		'0': { b: 1 }
	});
	expect(readStoredTraceData({ id: 'e', data: [{ a: null }], encoding: { data: 1 } })).toEqual({
		a: null
	});
	expect(readStoredTraceData({ id: 'n', data: [null], encoding: { data: 1 } })).toBeNull();
	expect(readStoredTraceData({ id: 'u' })).toBeNull();
	expect(() => readStoredTraceData({ id: 'x', data: ['text'], encoding: { data: 1 } })).toThrow(
		'JSON object'
	);
});

it('drops leftover keys only when they are tombstones or plausible historical values', () => {
	const staleAbsolute = { precision: 'day', certainty: 'exact', start: '2026-09-11', end: null };
	// Residue of repeated valid changes: minute and month values from different eras coexist.
	expect(
		projectStoredAboutTime({
			basis: 'relative',
			precision: 'unknown',
			anchorTraceId: 'anchor',
			relation: 'after',
			certainty: 'approximate',
			start: '2026-09-13T06:00:00.000Z',
			end: '2026-09'
		})
	).toEqual({
		basis: 'relative',
		precision: 'unknown',
		anchorTraceId: 'anchor',
		relation: 'after'
	});
	expect(
		projectStoredAboutTime({
			basis: 'unknown',
			precision: null,
			certainty: null,
			start: null,
			end: null
		})
	).toEqual({ basis: 'unknown' });
	// Impossible foreign values are kept so the strict parser refuses them with a useful error.
	expect(
		projectStoredAboutTime({ basis: 'unknown', precision: 'nonsense', start: { unexpected: true } })
	).toEqual({ basis: 'unknown', precision: 'nonsense', start: { unexpected: true } });
	expect(projectStoredAboutTime({ basis: 'unknown', ...staleAbsolute, certainty: 'sure' })).toEqual(
		{
			basis: 'unknown',
			certainty: 'sure'
		}
	);
	expect(
		projectStoredAboutTime({ basis: 'absolute', ...staleAbsolute, relation: 'sideways' })
	).toEqual({
		basis: 'absolute',
		...staleAbsolute,
		relation: 'sideways'
	});
	expect(projectStoredAboutTime({ basis: 'unknown', start: 'yesterday' })).toEqual({
		basis: 'unknown',
		start: 'yesterday'
	});
	expect(projectStoredAboutTime({ basis: 'unknown', end: 5 })).toEqual({
		basis: 'unknown',
		end: 5
	});
	expect(projectStoredAboutTime({ basis: 'unknown', anchorTraceId: ' ' })).toEqual({
		basis: 'unknown',
		anchorTraceId: ' '
	});
	// Prototype names are not variants: the value reaches the strict parser untouched.
	expect(projectStoredAboutTime({ basis: 'constructor', start: 'x' })).toEqual({
		basis: 'constructor',
		start: 'x'
	});
	expect(projectStoredAboutTime({ basis: 'toString' })).toEqual({ basis: 'toString' });
});

it('refuses impossible leftovers on read while valid residue and strict input keep their rules', () => {
	const refused = (aboutTime: unknown): string => {
		try {
			readStoredTraceTime({ id: 'r', aboutTime }, 'instant', legacy);
			return 'accepted';
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	};
	expect(refused({ basis: 'unknown', precision: 'nonsense', start: { unexpected: true } })).toMatch(
		'unsupported fields: precision, start'
	);
	expect(refused({ basis: 'unknown', certainty: 'sure' })).toMatch('unsupported fields: certainty');
	expect(refused({ basis: 'constructor', start: 'x' })).toMatch('basis must be one of');
	expect(refused({ basis: 'toString' })).toMatch('basis must be one of');
	expect(
		refused({
			basis: 'unknown',
			precision: 'day',
			certainty: 'exact',
			start: '2026-09-11',
			end: null
		})
	).toBe('accepted');
	// Incoming drafts are never projected: the same residue is invalid input.
	expect(() => parseTraceAboutTime({ basis: 'unknown', precision: 'day' })).toThrow(
		'unsupported fields'
	);
});

it('keeps an own __proto__ key from JSON as an unknown key for the strict parser', () => {
	// JSON.parse creates an own enumerable "__proto__" property; an object literal would not.
	const parsed = JSON.parse('{"basis":"unknown","__proto__":{"unexpected":true}}') as Record<
		string,
		unknown
	>;
	expect(Object.hasOwn(parsed, '__proto__')).toBe(true);
	const projected = projectStoredAboutTime(parsed) as Record<string, unknown>;
	expect(Object.hasOwn(projected, '__proto__')).toBe(true);
	expect(Object.getPrototypeOf(projected)).toBe(Object.prototype);
	expect(() => readStoredTraceTime({ id: 'p', aboutTime: parsed }, 'instant', legacy)).toThrow(
		'unsupported fields: __proto__'
	);
	const defined = Object.defineProperty({ basis: 'unknown', precision: 'day' }, '__proto__', {
		value: { unexpected: true },
		enumerable: true,
		configurable: true,
		writable: true
	});
	expect(() => readStoredTraceTime({ id: 'd', aboutTime: defined }, 'instant', legacy)).toThrow(
		'unsupported fields: __proto__'
	);
});
