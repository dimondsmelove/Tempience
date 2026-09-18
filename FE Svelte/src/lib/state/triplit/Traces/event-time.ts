import { calendarValueBounds } from '../trace-time';
import type { Trace } from '../types';

/** What places a record in time: its kind of placement, its own time and a stated duration. */
export type TracePlacement = Pick<Trace, 'aboutKind' | 'aboutTime' | 'statedDuration'>;

export type TraceSpan = { start: number; end: number };

/**
 * E3 ordering key of a record: an instant uses its start; an interval with known boundaries
 * and no stated duration uses its end; a stated duration or an approximate window keeps the
 * start. Minute precision is the instant itself, coarser precision the start of its calendar
 * unit. Unknown, relative and reference placements have no key.
 */
export const traceEventKey = (trace: TracePlacement): string | null => {
	const time = trace.aboutTime;
	if (trace.aboutKind === 'trace_ref' || !time || time.basis !== 'absolute') return null;
	const useEnd = trace.aboutKind === 'interval' && time.end !== null && !trace.statedDuration;
	const value = useEnd && time.end !== null ? time.end : time.start;
	return new Date(calendarValueBounds(value, time.precision).start).toISOString();
};

/** The record's own span in ms — the calendar units its time covers — or null without one. */
export const traceSpan = (trace: TracePlacement): TraceSpan | null => {
	const time = trace.aboutTime;
	if (trace.aboutKind === 'trace_ref' || !time || time.basis !== 'absolute') return null;
	try {
		return {
			start: calendarValueBounds(time.start, time.precision).start,
			end: calendarValueBounds(time.end ?? time.start, time.precision).end
		};
	} catch {
		return null;
	}
};

/** Whether a span touches the period [from, to]; an unset bound constrains nothing. */
export const spanTouches = (span: TraceSpan, from: number | null, to: number | null): boolean =>
	(from === null || span.end > from) && (to === null || span.start < to);
