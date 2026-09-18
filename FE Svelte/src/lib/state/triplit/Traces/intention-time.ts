import { calendarValueBounds, compareCalendarValues } from '../trace-time';
import type {
	TemporalPrecision,
	TraceAboutKind,
	TraceAboutTime,
	TraceDuration,
	TraceRelation
} from '../types';

export type TemporalPlacementInput = {
	aboutKind: TraceAboutKind;
	aboutTime: TraceAboutTime | null;
	statedDuration?: TraceDuration | null;
};

export type IntentionTimeInput = TemporalPlacementInput & { relation: TraceRelation | null };

export type IntentionTimeCheck = { ok: true } | { ok: false; reason: 'past' };

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

/**
 * Whether the planned start can no longer lie ahead of `now`. An intention time means "when I
 * plan to do it" (core/time.md), so only the start is judged — never an end or a deadline:
 * - an exact minute value is a point and must be strictly after now; no display slot or
 *   calendar minute is added to it;
 * - a coarse value (day, month, season, year) names its whole unit as the possible start, so
 *   "today" stays assignable until the day is over;
 * - a declared uncertainty window (approximate instant, or a stated-duration start with a
 *   window) allows the start anywhere up to the window's inclusive end;
 * - an interval's explicit end is its extent, not a window: a plan that has already begun is
 *   not a newly assigned future plan even if it ends later; a stated duration locates the
 *   start and never invents a future start or end.
 * Unknown, relative and reference placements never elapse. Invalid values throw like the
 * calendar helpers do.
 */
export const plannedStartElapsed = (placement: TemporalPlacementInput, now: number): boolean => {
	const time = placement.aboutTime;
	if (placement.aboutKind === 'trace_ref' || !time || time.basis !== 'absolute') return false;
	if (time.end !== null && (placement.aboutKind === 'instant' || placement.statedDuration)) {
		return calendarValueBounds(time.end, time.precision).end <= now;
	}
	const start = calendarValueBounds(time.start, time.precision);
	return (time.precision === 'minute' ? start.start : start.end) <= now;
};

/**
 * Accepted manual input rule for intentions: a newly assigned time must lie in the future,
 * no time is allowed, and a saved past time stays valid as long as the final submitted value
 * equals the original placement — compared as times, not as spellings or touched controls.
 * Facts and non-absolute placements are unaffected. Shared by the save command, which passes
 * its operation time as `now`, and the form's live validation; UI presets after a relation
 * switch are the form's own concern.
 */
export const validateManualIntentionTime = (
	original: TemporalPlacementInput | null,
	next: IntentionTimeInput,
	now: number = Date.now()
): IntentionTimeCheck => {
	if (next.relation !== 'intend') return { ok: true };
	if (next.aboutTime === null || next.aboutTime.basis !== 'absolute') return { ok: true };
	if (original && samePlacement(original, next)) return { ok: true };
	return plannedStartElapsed(next, now) ? { ok: false, reason: 'past' } : { ok: true };
};
