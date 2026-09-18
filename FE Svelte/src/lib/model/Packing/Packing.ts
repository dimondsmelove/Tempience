import {
	DAY_MS,
	MAX_POINT_WIDTH_PX,
	MAX_TRACKS,
	MIN_INTERVAL_WIDTH_PX,
	MIN_POINT_WIDTH_PX,
	ROW_BOTTOM_RESERVE_PX,
	TRACK_GAP_PX,
	TRACK_HEIGHT_MAX_PX,
	TRACK_HEIGHT_PX,
	TRACK_PITCH_PX,
	TRACK_PITCH_MIN_PX,
	TRACK_TOP_MIN_PX
} from './constants';
import type { PackItem, PackOptions, PackResult, TrackGeometry } from './types';

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

/** Rendered width of an item at a scale: points are a clamped day, intervals their real length. */
export const itemWidthPx = (item: PackItem, options: PackOptions): number => {
	const min = options.minPointWidth ?? MIN_POINT_WIDTH_PX;
	const max = options.maxPointWidth ?? MAX_POINT_WIDTH_PX;
	if (item.kind === 'point' || item.end === null) return clamp(options.pxPerDay, min, max);
	const days = (item.end - item.start) / DAY_MS;
	return Math.max(MIN_INTERVAL_WIDTH_PX, days * options.pxPerDay);
};

/**
 * Greedy first-fit packing of a row's items into tracks.
 *
 * Positions are taken from absolute time times pixels per day, so the result
 * depends only on the scale, never on where the visible window starts: panning
 * cannot move an item to another track. When every track is busy the item goes
 * to the track that frees up first and is counted as an overlap; the renderer
 * then shows density through the overlap itself.
 */
export const packTracks = (items: readonly PackItem[], options: PackOptions): PackResult => {
	const maxTracks = options.maxTracks ?? MAX_TRACKS;
	const gap = options.gap ?? TRACK_GAP_PX;
	const trackEnds: number[] = [];
	const trackOf = new Map<string, number>();
	let overlaps = 0;

	for (const item of [...items].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
		const left = (item.start / DAY_MS) * options.pxPerDay;
		const right = left + itemWidthPx(item, options);
		let track = trackEnds.findIndex((end) => end <= left - gap);
		if (track < 0) {
			if (trackEnds.length < maxTracks) {
				track = trackEnds.length;
				trackEnds.push(right);
			} else {
				track = trackEnds.indexOf(Math.min(...trackEnds));
				trackEnds[track] = Math.max(trackEnds[track], right);
				overlaps += 1;
			}
		} else {
			trackEnds[track] = right;
		}
		trackOf.set(item.id, track);
	}

	return { trackOf, tracks: Math.max(1, trackEnds.length), overlaps };
};

/** Height of one track when a row uses `tracks` of them, at the minimum pitch. */
export const trackHeightPx = (tracks: number): number =>
	TRACK_HEIGHT_PX[clamp(tracks, 1, MAX_TRACKS) as keyof typeof TRACK_HEIGHT_PX];

/** Taller rows use the added height for tracks; the font changes capacity, never row height. */
export const trackCapacity = (rowHeightPx: number, fontPx = 12): number =>
	Math.max(
		MAX_TRACKS,
		Math.floor(
			(rowHeightPx - ROW_BOTTOM_RESERVE_PX - 2 * TRACK_TOP_MIN_PX) /
				Math.max(TRACK_PITCH_PX, Math.ceil(fontPx) + 2)
		)
	);

export const trackGeometry = (rowHeightPx: number, tracks: number, fontPx = 12): TrackGeometry => {
	const usable = rowHeightPx - ROW_BOTTOM_RESERVE_PX - 2 * TRACK_TOP_MIN_PX;
	const pitchPx = clamp(
		Math.floor(usable / trackCapacity(rowHeightPx, fontPx)),
		TRACK_PITCH_MIN_PX,
		Math.max(TRACK_PITCH_PX, Math.ceil(fontPx) + 2)
	);
	return {
		pitchPx,
		trackHeightPx:
			pitchPx === TRACK_PITCH_MIN_PX
				? trackHeightPx(tracks)
				: Math.min(TRACK_HEIGHT_MAX_PX, pitchPx - 2)
	};
};

/** Tracks needed by the items that are actually visible; keeps far-away collisions from shrinking a row. */
export const visibleTracks = (
	trackOf: ReadonlyMap<string, number>,
	visibleIds: readonly string[]
): number => {
	let max = 0;
	for (const id of visibleIds) max = Math.max(max, (trackOf.get(id) ?? 0) + 1);
	return Math.max(1, max);
};
