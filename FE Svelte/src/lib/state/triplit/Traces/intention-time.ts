import { compareCalendarValues } from '../trace-time';
import type { TemporalPrecision, TraceAboutKind, TraceAboutTime, TraceDuration } from '../types';

export type TemporalPlacementInput = {
	aboutKind: TraceAboutKind;
	aboutTime: TraceAboutTime | null;
	statedDuration?: TraceDuration | null;
};

const sameCalendarValue = (
	left: string | null,
	right: string | null,
	precision: TemporalPrecision
): boolean =>
	left === null || right === null
		? left === right
		: compareCalendarValues(left, right, precision) === 0;

/** Two stored times mean the same time; calendar values compare by their unit, not spelling. */
const sameAboutTime = (left: TraceAboutTime | null, right: TraceAboutTime | null): boolean => {
	if (left === null || right === null) return left === right;
	if (left.basis === 'unknown' || right.basis === 'unknown') return left.basis === right.basis;
	if (left.basis === 'relative' || right.basis === 'relative') {
		return (
			left.basis === 'relative' &&
			right.basis === 'relative' &&
			left.precision === right.precision &&
			left.anchorTraceId === right.anchorTraceId &&
			left.relation === right.relation
		);
	}
	return (
		left.precision === right.precision &&
		left.certainty === right.certainty &&
		sameCalendarValue(left.start, right.start, left.precision) &&
		sameCalendarValue(left.end, right.end, left.precision)
	);
};

const sameDuration = (
	left: TraceDuration | null | undefined,
	right: TraceDuration | null | undefined
): boolean =>
	left == null || right == null
		? (left ?? null) === (right ?? null)
		: left.amount === right.amount && left.unit === right.unit;

/** The two placements mean the same time: same kind, same time, same stated duration. */
export const samePlacement = (
	left: TemporalPlacementInput,
	right: TemporalPlacementInput
): boolean =>
	left.aboutKind === right.aboutKind &&
	sameAboutTime(left.aboutTime, right.aboutTime) &&
	sameDuration(left.statedDuration, right.statedDuration);
