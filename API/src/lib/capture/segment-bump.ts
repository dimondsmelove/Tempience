import type { ContinuitySegment } from '@chronograph/shared';
import { segmentActiveAt } from '@chronograph/shared';

type SegmentRow = {
	uid: string;
	continuityUid: string;
	phase: string;
	startAt: string | null;
	endAt: string | null;
	label: string | null;
	sortOrder: number;
	createdAt: string;
};

export const pickActiveSegment = (
	segments: SegmentRow[],
	at: string
): SegmentRow | null => {
	const active = segments
		.filter((segment) =>
			segmentActiveAt({ start_at: segment.startAt, end_at: segment.endAt }, at)
		)
		.sort((a, b) => a.sortOrder - b.sortOrder);
	return active.at(-1) ?? null;
};

export const bumpContinuitySegment = (input: {
	continuityUid: string;
	at: string;
	label: string | null;
	phase: ContinuitySegment['phase'];
	existingSegments: SegmentRow[];
	insertSegment: (row: SegmentRow) => void;
	updateSegmentEnd: (uid: string, endAt: string) => void;
	newUid: () => string;
}): SegmentRow => {
	const open = [...input.existingSegments]
		.filter((segment) => !segment.endAt)
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.at(-1);

	if (open) {
		input.updateSegmentEnd(open.uid, input.at);
	}

	const row: SegmentRow = {
		uid: input.newUid(),
		continuityUid: input.continuityUid,
		phase: input.phase,
		startAt: input.at,
		endAt: null,
		label: input.label,
		sortOrder: input.existingSegments.length,
		createdAt: input.at
	};

	input.insertSegment(row);
	return row;
};
