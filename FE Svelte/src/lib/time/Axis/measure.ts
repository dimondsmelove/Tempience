import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import { monthsShort, weekdaysShort, weekLabelPrefix } from '$lib/model/Axis/constants';
import type { LabelWidths } from '$lib/model/Axis/types';

/** The widest label of each kind, measured in the fonts the rows are drawn with. */
export const measureWidths = (
	g: CanvasRenderingContext2D,
	fonts: Readonly<{ major: string; minor: string }>,
	language: Locale
): LabelWidths => {
	const widest = (font: string, samples: readonly string[]): number => {
		g.font = font;
		return Math.max(...samples.map((sample) => g.measureText(sample).width));
	};
	const week = weekLabelPrefix(language);
	return {
		decade: widest(fonts.major, [translate(language, 'axis.decade', { year: 2020 })]),
		year: widest(fonts.major, ['2026']),
		month: widest(fonts.minor, monthsShort(language)),
		week: widest(fonts.minor, [`${week}52`]),
		weekDate: widest(fonts.minor, [`${week}52 · 30`]),
		day: widest(fonts.minor, ['31']),
		weekday: widest(
			fonts.minor,
			weekdaysShort(language).map((day) => `${day} 31`)
		)
	};
};
