import { placeLabels } from '$lib/model/Labels/Labels';
import { LABEL_FONT_PX } from '$lib/model/Labels/constants';
import type { MarkBox } from '$lib/model/Labels/types';
import {
	DAY_MS,
	MAX_POINT_WIDTH_PX,
	MIN_INTERVAL_WIDTH_PX,
	MIN_POINT_WIDTH_PX,
	ROW_BOTTOM_RESERVE_PX,
	ROW_HEIGHT_MIN_PX,
	TRACK_TOP_MIN_PX
} from '$lib/model/Packing/constants';
import {
	packTracks,
	trackCapacity,
	trackGeometry,
	visibleTracks
} from '$lib/model/Packing/Packing';
import type { PackItem } from '$lib/model/Packing/types';
import type { ProjectedRow } from '$lib/model/Projection/types';
import { FUZZY_BAND_OFFSET_PX, FUZZY_BAND_PX, MIN_ROWS_HEIGHT_PX } from './constants';
import type { LayoutOptions, RibbonLayout, RowLayout } from './types';

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

/**
 * Pixel geometry of the ribbon for one window: rows of `rowHeightPx` (52 px
 * as chosen on the device), marks packed into tracks by `model/Packing`
 * over every record of the row at the current scale, captions by
 * `model/Labels`. Fuzzy dates become an underlay band at the bottom of the
 * row and take no track.
 */
export const layoutRibbon = (
	rows: readonly ProjectedRow[],
	options: LayoutOptions
): RibbonLayout => {
	const { window, widthPx } = options;
	const rowHeightPx = options.rowHeightPx ?? ROW_HEIGHT_MIN_PX;
	const span = window.end - window.start;
	const x = (t: number): number => ((t - window.start) / span) * widthPx;
	const pxPerDay = widthPx / (span / DAY_MS);
	const pointWidth = clamp(pxPerDay, MIN_POINT_WIDTH_PX, MAX_POINT_WIDTH_PX);
	const fontPx = options.fontPx ?? LABEL_FONT_PX;

	const layouts: RowLayout[] = rows.map((row, index) => {
		const y0 = index * rowHeightPx;
		const y1 = y0 + rowHeightPx;
		const items: PackItem[] = [];
		for (const mark of row.marks) {
			if (mark.kind === 'fuzzy') continue;
			items.push({
				id: mark.id,
				start: mark.start,
				end: mark.kind === 'moment' ? null : mark.end,
				kind: mark.kind === 'moment' ? 'point' : 'interval'
			});
		}
		const packed = packTracks(items, { pxPerDay, maxTracks: trackCapacity(rowHeightPx, fontPx) });
		const visibleIds = items
			.filter(
				(item) =>
					x(item.end ?? item.start) + pointWidth >= 0 && x(item.start) - pointWidth <= widthPx
			)
			.map((item) => item.id);
		const tracks = visibleTracks(packed.trackOf, visibleIds);
		const { pitchPx, trackHeightPx: trackHeight } = trackGeometry(rowHeightPx, tracks, fontPx);
		const blockHeight = (tracks - 1) * pitchPx + trackHeight;
		const top =
			y0 +
			Math.max(
				TRACK_TOP_MIN_PX,
				Math.round((rowHeightPx - ROW_BOTTOM_RESERVE_PX - blockHeight) / 2)
			);

		const boxes: MarkBox[] = row.marks.map((mark) => {
			if (mark.kind === 'fuzzy') {
				return {
					mark,
					track: -1,
					x0: x(mark.start),
					x1: Math.max(x(mark.end), x(mark.start) + FUZZY_BAND_PX),
					y0: y1 - FUZZY_BAND_OFFSET_PX - FUZZY_BAND_PX,
					y1: y1 - FUZZY_BAND_OFFSET_PX
				};
			}
			const track = packed.trackOf.get(mark.id) ?? 0;
			const ty0 = top + track * pitchPx;
			if (mark.kind === 'moment') {
				const x0 = x(mark.start) - pointWidth / 2;
				return { mark, track, x0, x1: x0 + pointWidth, y0: ty0, y1: ty0 + trackHeight };
			}
			const x0 = x(mark.start);
			return {
				mark,
				track,
				x0,
				x1: Math.max(x(mark.end), x0 + MIN_INTERVAL_WIDTH_PX),
				y0: ty0,
				y1: ty0 + trackHeight
			};
		});
		const labels = placeLabels(boxes, {
			measure: options.measure,
			selectedTraceId: options.selectedTraceId,
			widthPx,
			fontPx,
			bounds: { top: y0, bottom: y1 }
		});
		const rangeX =
			row.range && x(row.range.end) >= 0 && x(row.range.start) <= widthPx
				? { x0: Math.max(0, x(row.range.start)), x1: Math.min(widthPx, x(row.range.end)) }
				: null;
		return { row, y0, y1, tracks, trackHeight, boxes, labels, rangeX };
	});

	return {
		rows: layouts,
		widthPx,
		heightPx: Math.max(
			options.minHeightPx ?? 0,
			rows.length ? rows.length * rowHeightPx : MIN_ROWS_HEIGHT_PX
		),
		window,
		pxPerDay,
		x
	};
};
