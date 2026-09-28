import type { TimeSelection } from '$lib/ui/TimeInput/types';
import type { TimeSpan } from './types';

/** The span as the TimeInput component takes it: exact, to the minute, no stated duration. */
export const selectionOf = (span: TimeSpan): TimeSelection => ({
	start: span.start,
	end: span.end,
	timed: true
});

/** The day's own midnight in the browser's zone: what a date without a time stands for. */
const midnight = (t: number): number => {
	const d = new Date(t);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * The span back from the component: a date without a time is that day from its midnight; an
 * end is kept only as the component left it — none, or «длится», is no end.
 */
export const spanOf = (selection: TimeSelection, withEnd: boolean): TimeSpan => {
	const at = (t: number): number => (selection.timed ? t : midnight(t));
	return {
		start: at(selection.start),
		end: withEnd && selection.end !== null && !selection.ongoing ? at(selection.end) : null
	};
};
