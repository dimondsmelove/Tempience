import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import type { TimeRange } from '$lib/model/Projection/types';
import { EXTENT_PAD_RATIO } from './constants';

/** The strip's own range: the data extent padded so the frame can reach the ends. */
export const stripRange = (extent: TimeRange | null, fallback: TimeRange): TimeRange => {
	if (!extent) return fallback;
	const start = Math.min(extent.start, fallback.start);
	const end = Math.max(extent.end, fallback.end);
	const pad = Math.max((end - start) * EXTENT_PAD_RATIO, 1);
	return { start: start - pad, end: end + pad };
};

/**
 * Records per bin across the strip, normalised to 0..1 by the fullest bin.
 * Intervals count in every bin they touch, so long ones read as a plateau.
 */
export const densityBins = (
	times: Iterable<TimeRange>,
	range: TimeRange,
	bins: number
): Float32Array => {
	const counts = new Float32Array(Math.max(1, bins));
	const span = range.end - range.start;
	if (span <= 0) return counts;
	const binOf = (t: number): number =>
		Math.min(
			counts.length - 1,
			Math.max(0, Math.floor(((t - range.start) / span) * counts.length))
		);
	let max = 0;
	for (const time of times) {
		if (time.end < range.start || time.start > range.end) continue;
		const first = binOf(time.start);
		const last = binOf(time.end);
		for (let bin = first; bin <= last; bin += 1) {
			counts[bin] += 1;
			if (counts[bin] > max) max = counts[bin];
		}
	}
	if (max > 0) for (let bin = 0; bin < counts.length; bin += 1) counts[bin] /= max;
	return counts;
};

/** Readout of the window span, e.g. «≈ 240 дн». */
export const spanReadout = (spanMs: number, language: Locale = 'ru'): string => {
	const days = spanMs / 86_400_000;
	if (days >= 365 * 2)
		return translate(language, 'overview.spanYears', {
			years: (days / 365).toFixed(1).replace(/\.0$/, '')
		});
	return translate(language, 'overview.spanDays', { days: Math.round(days) });
};
