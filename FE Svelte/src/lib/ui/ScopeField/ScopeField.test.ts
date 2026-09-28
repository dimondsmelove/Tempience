import { describe, expect, it } from 'vitest';
import { moveBefore } from './order';

describe('a Scope field’s order', () => {
	it('drops a chip before another, or at the end', () => {
		expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
		expect(moveBefore(['a', 'b', 'c'], 'a', null)).toEqual(['b', 'c', 'a']);
		expect(moveBefore(['a', 'b', 'c'], 'b', 'c')).toEqual(['a', 'b', 'c']);
	});
	it('leaves the order as it is for a drop on itself or of an id it does not hold', () => {
		expect(moveBefore(['a', 'b'], 'a', 'a')).toEqual(['a', 'b']);
		expect(moveBefore(['a', 'b'], 'x', 'a')).toEqual(['a', 'b']);
	});
});
