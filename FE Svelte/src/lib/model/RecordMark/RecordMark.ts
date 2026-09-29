import {
	BAND_TONE,
	CAPSULE_WIDTH_PX,
	HAZE_PEAK_TONE,
	STRIPE_PX,
	WOVEN_CAPSULE_WIDTH_PX
} from '$lib/model/MarkStyle/constants';
import type { RecordShape } from '$lib/model/RecordGroups/types';
import { MARK_WIDTH_PX } from './constants';
import type { MarkPaint } from './types';

const tone = (colour: string, share: number): string =>
	share === 1 ? colour : `color-mix(in oklab, ${colour} ${share * 100}%, transparent)`;

/** «Слои»: one horizontal layer per colour, top to bottom; one colour paints plainly. */
export const layers = (colours: readonly string[], share = 1): string =>
	colours.length === 1
		? tone(colours[0], share)
		: `linear-gradient(180deg, ${colours
				.map((colour, index) => {
					const from = (index * 100) / colours.length;
					const to = ((index + 1) * 100) / colours.length;
					return `${tone(colour, share)} ${from}% ${to}%`;
				})
				.join(', ')})`;

/** «Полосы»: 4 px stripes along the band, one colour after another. */
export const stripes = (colours: readonly string[], share: number): string =>
	`repeating-linear-gradient(90deg, ${colours
		.map(
			(colour, index) =>
				`${tone(colour, share)} ${index * STRIPE_PX}px ${(index + 1) * STRIPE_PX}px`
		)
		.join(', ')})`;

/**
 * A record's mark from its shape and the colours of all its Scopes (DESIGN §5): one colour
 * paints plainly, several weave — layers by default, stripes along an interval's band when it
 * has room for one of each — and a woven head is a pixel wider. No colour is ink.
 */
export const markPaint = (
	shape: RecordShape,
	colours: readonly string[],
	ink: string
): MarkPaint => {
	const unique = [...new Set(colours)];
	const paint = unique.length ? unique : [ink];
	const woven = paint.length > 1;
	const vague = shape === 'fuzzy' || shape === 'fuzzySpan';
	const head = vague ? 0 : woven ? WOVEN_CAPSULE_WIDTH_PX : CAPSULE_WIDTH_PX;
	const banded = shape === 'interval' || vague;
	const band = banded ? MARK_WIDTH_PX - head : 0;
	return {
		shape,
		head,
		headFill: head ? layers(paint) : null,
		band,
		// A vague date is a haze: its layers at the peak tone, faded at the ends by the component.
		bandFill:
			shape === 'fuzzy'
				? layers(paint, HAZE_PEAK_TONE)
				: banded
					? woven && band >= paint.length * STRIPE_PX
						? stripes(paint, BAND_TONE)
						: layers(paint, BAND_TONE)
					: null,
		dotted: shape === 'intent',
		woven
	};
};
