import type { MessageKey } from '$lib/state/Locale/types';
export const scalePresets: readonly { label: MessageKey; days: number }[] = [
	{ label: 'scale.threeYears', days: 1095 },
	{ label: 'scale.year', days: 365 },
	{ label: 'scale.quarter', days: 91 },
	{ label: 'scale.month', days: 30 },
	{ label: 'scale.week', days: 7 },
	{ label: 'scale.day', days: 2 }
];

/** A preset reads as active when the span is within this share of it. */
export const PRESET_TOLERANCE = 0.12;
