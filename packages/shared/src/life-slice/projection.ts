import type { Continuity } from '../schemas/continuity';
import type { ContinuitySegment } from '../schemas/continuity';

type ContinuityKind = Continuity['kind'];

/** Reading-pole heuristic for orient lens — not a capture taxonomy. */
export const continuityPole = (kind: ContinuityKind): 'inner' | 'outer' =>
	kind === 'relationship' ? 'outer' : 'inner';

type SegmentLike = Pick<ContinuitySegment, 'start_at' | 'end_at'>;

export const segmentActiveAt = (segment: SegmentLike, at: string): boolean => {
	const start = segment.start_at ?? at;
	if (start > at) return false;
	if (!segment.end_at) return true;
	return segment.end_at > at;
};

export const countPoles = (kinds: ContinuityKind[]): { inner_count: number; outer_count: number } => {
	let inner_count = 0;
	let outer_count = 0;
	for (const kind of kinds) {
		if (continuityPole(kind) === 'outer') outer_count += 1;
		else inner_count += 1;
	}
	return { inner_count, outer_count };
};
