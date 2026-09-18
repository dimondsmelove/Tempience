import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { formatTemporalValue, traceAboutTimeBounds } from '$lib/state/triplit/trace-time';
import { formatTraceDuration } from '$lib/state/triplit/trace-duration';
import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import type { MarkTime, ParkedReason } from './types';

/**
 * Classifies a record for the label language (DESIGN.md §5), repeating the
 * semantics of the previous front: an absolute `instant` is a moment, an
 * absolute `interval` with known boundaries is an interval, and a coarse date (month, season, year)
 * is a fuzzy underlay. An `approximate` certainty is read as a fuzzy date too.
 * `relation: 'intend'` hollows the silhouette; legacy relations read as actual.
 * Relative, unknown and trace-referenced times have no place on the axis.
 * A stated amount locates its start only; the glyph never invents an end from that amount.
 */
export const traceMarkTime = (trace: ExplorerTrace): MarkTime | null => {
	const aboutTime = trace.aboutTime;
	if (trace.aboutKind === 'trace_ref' || aboutTime?.basis !== 'absolute') return null;
	let bounds: { start: number; end: number } | null;
	try {
		bounds = traceAboutTimeBounds(trace.aboutKind, aboutTime, trace.statedDuration);
	} catch {
		// Repository validation owns compatibility; one invalid record must not hide the rest.
		return null;
	}
	if (!bounds) return null;
	const { precision, certainty } = aboutTime;
	const fuzzy =
		precision === 'month' ||
		precision === 'season' ||
		precision === 'year' ||
		certainty === 'approximate';
	const kind = fuzzy
		? 'fuzzy'
		: trace.aboutKind === 'interval' && !trace.statedDuration
			? 'interval'
			: 'moment';
	// A day-precision moment sits in the middle of its day rather than at midnight.
	const at = precision === 'minute' ? bounds.start : (bounds.start + bounds.end) / 2;
	return {
		kind,
		intent: trace.relation === 'intend',
		start: kind === 'moment' ? at : bounds.start,
		end: kind === 'moment' ? at : bounds.end,
		precision,
		certainty
	};
};

export const parkedReason = (trace: ExplorerTrace): ParkedReason => {
	if (trace.aboutKind === 'trace_ref') return 'trace_ref';
	return trace.aboutTime?.basis === 'relative' ? 'relative' : 'unknown';
};

/** Human date of a record as the twin and the parked strip show it, in the given language. */
export const traceTimeLabel = (
	trace: Pick<ExplorerTrace, 'aboutKind' | 'aboutTime' | 'statedDuration'>,
	language: Locale = 'ru'
): string => {
	const placement = tracePlacementLabel(trace, language);
	return trace.statedDuration
		? `${placement} · ${formatTraceDuration(trace.statedDuration, language)}`
		: placement;
};

const tracePlacementLabel = (
	trace: Pick<ExplorerTrace, 'aboutKind' | 'aboutTime' | 'statedDuration'>,
	language: Locale
): string => {
	const aboutTime = trace.aboutTime;
	if (trace.aboutKind === 'trace_ref') return translate(language, 'time.traceRef');
	if (!aboutTime || aboutTime.basis === 'unknown') return translate(language, 'time.unknownTime');
	if (aboutTime.basis === 'relative') return `${aboutTime.relation} ${aboutTime.anchorTraceId}`;
	try {
		const prefix =
			(trace.statedDuration ? translate(language, 'time.startPrefix') : '') +
			(aboutTime.certainty === 'approximate' ? '≈ ' : '');
		const start = formatTemporalValue(aboutTime.start, aboutTime.precision, language);
		if (aboutTime.end === null || aboutTime.end === aboutTime.start) return `${prefix}${start}`;
		return `${prefix}${start} — ${formatTemporalValue(aboutTime.end, aboutTime.precision, language)}`;
	} catch {
		return translate(language, 'time.incompatible');
	}
};
