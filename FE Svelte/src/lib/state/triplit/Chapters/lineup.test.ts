import { describe, expect, it } from 'vitest';
import { keepHiddenEntries, lineupInput, readStoredLineup, visibleLineup } from './lineup';

const focus = (scopeId: string) => ({ scopeId, level: 'focus' as const });
const support = (scopeId: string) => ({ scopeId, level: 'support' as const });

describe('the stored lineup', () => {
	it('reads leniently: a malformed entry or a repeated Scope is left out', () => {
		expect(
			readStoredLineup([focus('a'), { scopeId: 'b', level: 'main' }, 7, support('a'), support('c')])
		).toEqual([focus('a'), focus('c')]);
		// «Поддержка» is gone (owner 2026-09-28): a stored support entry reads in front.
		expect(readStoredLineup(null)).toEqual([]);
	});
	it('writes strictly: every entry a Scope at a level, each Scope once', () => {
		expect(lineupInput([{ ...focus('a'), extra: 1 }])).toEqual([focus('a')]);
		expect(() => lineupInput([focus('a'), support('a')])).toThrow('twice');
		expect(() => lineupInput([{ scopeId: 'a' }])).toThrow('level');
		expect(() => lineupInput('a')).toThrow('array');
	});
	it('keeps a deleted Scope’s entry where it stood when a lineup read without it is written', () => {
		const stored = [focus('x'), focus('a'), support('y'), support('b'), support('z')];
		const hidden = new Set(['x', 'y', 'z']);
		expect(visibleLineup(stored, hidden)).toEqual([focus('a'), support('b')]);
		expect(keepHiddenEntries(stored, [support('b'), focus('a')], hidden)).toEqual([
			focus('x'),
			support('b'),
			support('z'),
			focus('a'),
			support('y')
		]);
		expect(keepHiddenEntries(stored, [focus('y')], hidden)).toEqual([
			focus('x'),
			focus('y'),
			support('z')
		]);
		expect(keepHiddenEntries(stored, [], new Set())).toEqual([]);
	});
});
