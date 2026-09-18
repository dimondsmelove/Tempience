import type { Continuity, ContinuitySegment } from '../schemas/continuity';

type ContinuityInterval = Pick<Continuity, 'started_at' | 'ended_at'>;
type SegmentInterval = Pick<ContinuitySegment, 'start_at' | 'end_at'>;

export const continuityIntervalValid = (continuity: ContinuityInterval): boolean => {
	if (!continuity.started_at || !continuity.ended_at) return true;
	return continuity.started_at <= continuity.ended_at;
};

export const segmentIntervalValid = (segment: SegmentInterval): boolean => {
	if (!segment.start_at || !segment.end_at) return true;
	return segment.start_at <= segment.end_at;
};

export const segmentWithinContinuity = (
	continuity: ContinuityInterval,
	segment: SegmentInterval
): boolean => {
	if (!segmentIntervalValid(segment)) return false;
	if (!continuityIntervalValid(continuity)) return false;

	const segmentStart = segment.start_at;
	if (!segmentStart) return false;

	if (continuity.started_at && segmentStart < continuity.started_at) return false;
	if (segment.end_at && continuity.ended_at && segment.end_at > continuity.ended_at) return false;

	return true;
};
