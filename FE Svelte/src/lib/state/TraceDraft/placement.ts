import { CodedError } from '$lib/model/Errors/CodedError';
import type { Trace } from '$lib/state/triplit/types';
import type { TemporalPlacement, TimeDraft } from './types';

/** The saved placement of a record as the time controls and the save read it. */
export const savedPlacement = (
	trace: Pick<Trace, 'aboutKind' | 'aboutTime' | 'statedDuration' | 'aboutTraceId'> | null
): TemporalPlacement | null =>
	trace
		? {
				aboutKind: trace.aboutKind,
				aboutTime: trace.aboutTime,
				...(trace.statedDuration ? { statedDuration: trace.statedDuration } : {}),
				aboutTraceId: trace.aboutTraceId
			}
		: null;

/** An exact minute «now» — the initial time of a new fact and of an intention turned fact. */
export const nowPlacement = (now = new Date()): TemporalPlacement => ({
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'minute',
		certainty: 'exact',
		start: now.toISOString(),
		end: null
	},
	aboutTraceId: null
});

/** The supplement marker (P4): a reference without its own time or inline address. */
export const markerPlacement = (): TemporalPlacement => ({
	aboutKind: 'trace_ref',
	aboutTime: null,
	aboutTraceId: null
});

/** No date at all — what a fact turned intention gets. */
export const undatedPlacement = (): TemporalPlacement => ({
	aboutKind: 'instant',
	aboutTime: { basis: 'unknown' },
	aboutTraceId: null
});

/** A new record starts at «now»; an existing one keeps its saved time until a change is chosen. */
export function initialTime(trace?: TemporalPlacement | null, now = new Date()): TimeDraft {
	if (trace) return { mode: 'keep' };
	return { mode: 'chosen', chosen: nowPlacement(now) };
}

export function temporalPlacement(
	draft: TimeDraft,
	existing?: TemporalPlacement | null
): TemporalPlacement {
	if (draft.mode === 'chosen') return draft.chosen;
	if (!existing) throw new CodedError('placement_no_time', 'Нет исходного времени записи.');
	return {
		aboutKind: existing.aboutKind,
		aboutTime: existing.aboutTime,
		...(existing.statedDuration ? { statedDuration: existing.statedDuration } : {}),
		aboutTraceId: existing.aboutTraceId
	};
}
