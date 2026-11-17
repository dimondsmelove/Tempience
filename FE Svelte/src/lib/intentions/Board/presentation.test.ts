import { describe, expect, it, vi } from 'vitest';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import type { Hierarchy } from '../Hierarchy/Hierarchy';
import { readBacklogOpen, visibleTreeRows, writeBacklogOpen } from './presentation';

const item = (id: string) => ({ id }) as ExplorerTrace;
const entry = (parents: string[], children: string[]) => ({
	parents,
	children,
	progress: null,
	closeSuggested: false
});
describe('board presentation', () => {
	it('hides descendants of a collapsed branch and restores them on expansion', () => {
		const hierarchy: Hierarchy = new Map([
			['a', entry([], ['b'])],
			['b', entry(['a'], ['c'])],
			['c', entry(['b'], [])]
		]);
		const items = [item('a'), item('b'), item('c')];
		expect(visibleTreeRows(items, hierarchy, new Set(['b'])).map((row) => row.trace.id)).toEqual([
			'a',
			'b'
		]);
		expect(visibleTreeRows(items, hierarchy, new Set()).map((row) => row.trace.id)).toEqual([
			'a',
			'b',
			'c'
		]);
	});
	it('uses optional storage without breaking when storage is unavailable', () => {
		expect(readBacklogOpen({ getItem: () => 'true' })).toBe(true);
		expect(readBacklogOpen({ getItem: () => null })).toBe(false);
		expect(
			readBacklogOpen({
				getItem: () => {
					throw new Error('denied');
				}
			})
		).toBe(false);
		const setItem = vi.fn();
		writeBacklogOpen({ setItem }, true);
		expect(setItem).toHaveBeenCalledWith('tempience.intentions.backlog.open', 'true');
		expect(() =>
			writeBacklogOpen(
				{
					setItem: () => {
						throw new Error('denied');
					}
				},
				false
			)
		).not.toThrow();
	});
});
