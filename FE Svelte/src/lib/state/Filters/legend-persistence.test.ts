import { describe, expect, it, vi } from 'vitest';
import { FiltersState } from './Filters.svelte';
import type { LegendView } from '../triplit/LegendView/types';
import type { LegendViewRepository } from '../triplit/LegendView/LegendView';

function fake() {
	let next: (view: LegendView) => void = () => {};
	const stop = vi.fn();
	const setLegendView = vi.fn(async (view: LegendView) => {
		void view;
	});
	const repository: LegendViewRepository = {
		subscribeLegendView: (callback) => {
			next = callback;
			return stop;
		},
		getLegendView: async () => ({ hiddenLegend: [], soloLegend: null }),
		setLegendView
	};
	return { repository, stop, setLegendView, emit: (view: LegendView) => next(view) };
}
const flush = async () => {
	for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('legend persistence', () => {
	it('restores views and applies external updates without writing', () => {
		const state = new FiltersState();
		const repo = fake();
		state.connect(repo.repository);
		expect(state.activeCount).toBe(0);
		repo.emit({ hiddenLegend: ['fact'], soloLegend: 'intent' });
		expect(state.hiddenLegend.has('fact')).toBe(true);
		expect(state.soloLegend).toBe('intent');
		expect(state.activeCount).toBe(2);
		repo.emit({ hiddenLegend: [], soloLegend: null });
		expect(state.activeCount).toBe(0);
		expect(repo.setLegendView).not.toHaveBeenCalled();
	});
	it('writes legend commands and reset, but not other filters', async () => {
		const state = new FiltersState();
		const repo = fake();
		state.connect(repo.repository);
		state.hideScope('a');
		state.setOnly(['b']);
		state.toggleKind('kind');
		state.scopeQuery = 'x';
		state.recordQuery = 'y';
		expect(repo.setLegendView).not.toHaveBeenCalled();
		state.toggleLegend('fact');
		state.soloLegendKind('intent');
		state.reset();
		await flush();
		expect(repo.setLegendView.mock.calls.map(([view]) => view)).toEqual([
			{ hiddenLegend: ['fact'], soloLegend: null },
			{ hiddenLegend: ['fact'], soloLegend: 'intent' },
			{ hiddenLegend: [], soloLegend: null }
		]);
		state.reset();
		await flush();
		expect(repo.setLegendView).toHaveBeenCalledTimes(3);
	});
	it('ignores an earlier feed while a write is pending and reconciles afterward', async () => {
		let finish!: () => void;
		let emit!: (view: LegendView) => void;
		const repository: LegendViewRepository = {
			subscribeLegendView: (next) => {
				emit = next;
				return () => {};
			},
			setLegendView: () =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
			getLegendView: async () => ({ hiddenLegend: ['fact'], soloLegend: null })
		};
		const state = new FiltersState();
		state.connect(repository);
		state.toggleLegend('fact');
		await Promise.resolve();
		emit({ hiddenLegend: [], soloLegend: null });
		expect(state.hiddenLegend.has('fact')).toBe(true);
		finish();
		await flush();
		emit({ hiddenLegend: ['fact'], soloLegend: null });
		expect(state.hiddenLegend.has('fact')).toBe(true);
	});
	it('disconnects the old space and starts the new one with defaults', () => {
		const state = new FiltersState();
		const first = fake();
		const second = fake();
		const oldStop = state.connect(first.repository);
		first.emit({ hiddenLegend: ['fact'], soloLegend: null });
		const stop = state.connect(second.repository);
		expect(first.stop).toHaveBeenCalledOnce();
		expect(state.activeCount).toBe(0);
		first.emit({ hiddenLegend: ['open'], soloLegend: null });
		second.emit({ hiddenLegend: [], soloLegend: 'intent' });
		oldStop();
		expect(state.soloLegend).toBe('intent');
		stop();
		expect(second.stop).toHaveBeenCalledOnce();
	});
});
