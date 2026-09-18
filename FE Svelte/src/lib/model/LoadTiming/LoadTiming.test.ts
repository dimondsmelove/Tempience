import { describe, expect, it } from 'vitest';
import { createLoadTiming } from './LoadTiming';
import type { LoadTimingClock } from './types';

const fakeClock = (start = 1000) => {
	let now = start;
	const marks: string[] = [];
	const measures: [string, string, string][] = [];
	const clock: LoadTimingClock = {
		now: () => now,
		mark: (name) => {
			marks.push(name);
		},
		measure: (name, from, to) => {
			measures.push([name, from, to]);
		}
	};
	return {
		clock,
		marks,
		measures,
		advance: (ms: number) => {
			now += ms;
		}
	};
};

describe('LoadTiming', () => {
	it('measures a span with User Timing marks and a measure', async () => {
		const { clock, marks, measures, advance } = fakeClock();
		const timing = createLoadTiming(clock);

		const value = await timing.span('seed', async () => {
			advance(12.34);
			return 'ok';
		});

		expect(value).toBe('ok');
		expect(marks).toEqual(['tempience:load:seed:start', 'tempience:load:seed:end']);
		expect(measures).toEqual([
			['tempience:load:seed', 'tempience:load:seed:start', 'tempience:load:seed:end']
		]);
		expect(timing.report()).toEqual({ seed: 12.3, sinceNavigation: 1012.3 });
	});

	it('still ends a step whose run rejected', async () => {
		const { clock, measures, advance } = fakeClock();
		const timing = createLoadTiming(clock);

		await expect(
			timing.span('snapshot', async () => {
				advance(5);
				throw new Error('boom');
			})
		).rejects.toThrow('boom');

		expect(measures).toHaveLength(1);
		expect(timing.report().snapshot).toBe(5);
	});

	it('reports only ended steps and ignores an end without a start', () => {
		const { clock, advance } = fakeClock(0);
		const timing = createLoadTiming(clock);

		timing.start('storage');
		advance(300);
		timing.end('seed');
		expect(timing.report()).toEqual({ sinceNavigation: 300 });

		timing.end('storage');
		expect(timing.report()).toEqual({ storage: 300, sinceNavigation: 300 });
	});

	it('drops the previous duration when a step starts again', () => {
		const { clock, advance } = fakeClock(0);
		const timing = createLoadTiming(clock);

		timing.start('snapshot');
		advance(40);
		timing.end('snapshot');
		timing.start('snapshot');
		expect(timing.report()).toEqual({ sinceNavigation: 40 });
	});

	it('is a no-op without a clock', async () => {
		const timing = createLoadTiming(null);

		timing.start('storage');
		timing.end('storage');

		await expect(timing.span('seed', async () => 7)).resolves.toBe(7);
		expect(timing.report()).toEqual({ sinceNavigation: 0 });
	});
});
