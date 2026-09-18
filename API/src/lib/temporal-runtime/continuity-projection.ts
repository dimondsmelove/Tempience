import type { ContinuityLane, ContinuitySegment } from '@chronograph/shared';
import { fractionalMinuteOfWeekInZone } from '@chronograph/shared';

type ContinuityRow = {
	uid: string;
	name: string;
	kind: string;
};

type SegmentRow = {
	uid: string;
	continuityUid: string;
	phase: string;
	startAt: string | null;
	endAt: string | null;
	label: string | null;
	sortOrder: number;
};

const clampFraction = (value: number): number => Math.min(10080, Math.max(0, value));

export const buildContinuityLanes = (input: {
	continuities: ContinuityRow[];
	segments: SegmentRow[];
	weekStart: string;
	timezone: string;
	anchorAt: string;
}): ContinuityLane[] => {
	const anchorFraction = fractionalMinuteOfWeekInZone(
		input.anchorAt,
		input.weekStart,
		input.timezone
	);

	const segmentsByContinuity = new Map<string, SegmentRow[]>();
	for (const segment of input.segments) {
		const list = segmentsByContinuity.get(segment.continuityUid) ?? [];
		list.push(segment);
		segmentsByContinuity.set(segment.continuityUid, list);
	}

	return input.continuities.map((continuity, row) => {
		const rows = (segmentsByContinuity.get(continuity.uid) ?? []).sort(
			(a, b) => a.sortOrder - b.sortOrder
		);

		return {
			uid: continuity.uid,
			name: continuity.name,
			kind: continuity.kind as ContinuityLane['kind'],
			row,
			segments: rows.map((segment) => {
				const startIso = segment.startAt ?? input.anchorAt;
				const endIso = segment.endAt ?? input.anchorAt;
				const start_fraction = clampFraction(
					fractionalMinuteOfWeekInZone(startIso, input.weekStart, input.timezone)
				);
				const end_fraction = clampFraction(
					segment.endAt
						? fractionalMinuteOfWeekInZone(endIso, input.weekStart, input.timezone)
						: anchorFraction
				);
				return {
					uid: segment.uid,
					phase: segment.phase as ContinuitySegment['phase'],
					start_fraction: Math.min(start_fraction, end_fraction),
					end_fraction: Math.max(start_fraction, end_fraction),
					label: segment.label
				};
			})
		};
	});
};
