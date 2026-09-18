import { LOAD_TIMING_PREFIX } from './constants';
import type { LoadStep, LoadTimingClock, LoadTimingReport } from './types';

export interface LoadTiming {
	start(step: LoadStep): void;
	end(step: LoadStep): void;
	/** Runs `run` between `start` and `end` of the step, whatever its outcome. */
	span<T>(step: LoadStep, run: () => Promise<T>): Promise<T>;
	report(): LoadTimingReport;
}

const markName = (step: LoadStep, edge: 'start' | 'end'): string =>
	`${LOAD_TIMING_PREFIX}:${step}:${edge}`;

const round = (ms: number): number => Math.round(ms * 10) / 10;

/**
 * Times the steps of the read path with User Timing marks and measures, so the
 * DevTools Performance panel shows them, and keeps the durations for one summary.
 * Without a clock every call is a no-op and the report holds no step.
 */
export const createLoadTiming = (clock: LoadTimingClock | null): LoadTiming => {
	const started = new Map<LoadStep, number>();
	const durations = new Map<LoadStep, number>();

	const start = (step: LoadStep): void => {
		if (!clock) return;
		started.set(step, clock.now());
		durations.delete(step);
		clock.mark(markName(step, 'start'));
	};

	const end = (step: LoadStep): void => {
		const from = started.get(step);
		if (!clock || from === undefined) return;
		started.delete(step);
		durations.set(step, clock.now() - from);
		clock.mark(markName(step, 'end'));
		clock.measure(`${LOAD_TIMING_PREFIX}:${step}`, markName(step, 'start'), markName(step, 'end'));
	};

	return {
		start,
		end,
		async span(step, run) {
			start(step);
			try {
				return await run();
			} finally {
				end(step);
			}
		},
		report: () => {
			const report: LoadTimingReport = { sinceNavigation: round(clock?.now() ?? 0) };
			for (const [step, ms] of durations) report[step] = round(ms);
			return report;
		}
	};
};

/** The one timing of this page, backed by `performance` where the platform has it. */
export const loadTiming = createLoadTiming(typeof performance === 'undefined' ? null : performance);
