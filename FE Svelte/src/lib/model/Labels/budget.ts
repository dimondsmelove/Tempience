import type { Mark, TraceLink } from '$lib/model/Projection/types';
import {
	CAPTION_BUDGET_PX,
	CAPTION_MAX_CHARS,
	CAPTION_MIN_CUT_CHARS,
	WEEK_TIER_MAX_DAYS,
	YEAR_TIER_MIN_DAYS
} from './constants';
import type { CaptionClass, CaptionTier, MarkBox } from './types';

/**
 * The caption budget of a row (Q1-A, owner 2026-09-19): rows full of long fact
 * titles turned the canvas into text, so at rest a row shows at most one caption
 * per `CAPTION_BUDGET_PX` of its width, the captions are chosen by priority, a
 * long text is cut on a word boundary, and the coarse scales keep captions for
 * intentions and intervals alone. All of it is pure over marks and pixels; the
 * selected, lit and matching records bypass every part of it in `captions.ts`.
 */

const CLASS_RANK: Readonly<Record<CaptionClass, number>> = {
	intention: 0,
	interval: 1,
	linked: 2,
	fact: 3
};

/** The last class a tier still captions: «год» stops at intervals; «месяц» and «неделя» admit facts too. */
const TIER_FLOOR: Readonly<Record<CaptionTier, CaptionClass>> = {
	year: 'interval',
	month: 'fact',
	week: 'fact'
};

/**
 * What the budget serves first: an open intention (overdue included) or an interval
 * that «длится», then an interval with an end, then a fact an explicit link touches,
 * then every other fact — closed intentions and fuzzy dates among them.
 */
export const captionClass = (mark: Mark, linked: ReadonlySet<string>): CaptionClass => {
	if ((mark.intent && !mark.closed) || mark.open) return 'intention';
	if (mark.kind === 'interval') return 'interval';
	return linked.has(mark.traceId) ? 'linked' : 'fact';
};

/** Whether a tier still captions a class at rest (Q1-A п. 3). */
export const tierAdmits = (tier: CaptionTier, cls: CaptionClass): boolean =>
	CLASS_RANK[cls] <= CLASS_RANK[TIER_FLOOR[tier]];

/** The tier of a window by the days it shows: the toolbar's presets land as named («год» 365, «месяц» 30, «неделя» 7). */
export const captionTier = (windowDays: number): CaptionTier =>
	windowDays >= YEAR_TIER_MIN_DAYS ? 'year' : windowDays >= WEEK_TIER_MAX_DAYS ? 'month' : 'week';

/** Captions a row may show at rest: one per `CAPTION_BUDGET_PX` of the canvas, never fewer than one. */
export const captionBudget = (widthPx: number): number =>
	Math.max(1, Math.floor(widthPx / CAPTION_BUDGET_PX));

/**
 * The marks of a row in the order the budget serves them: the selected record first,
 * then by class, ties newer first (the later start), then by id so the order is stable.
 */
export const rankForBudget = (
	boxes: readonly MarkBox[],
	selectedTraceId: string | null,
	linked: ReadonlySet<string>
): MarkBox[] =>
	boxes.toSorted(
		(a, b) =>
			Number(b.mark.traceId === selectedTraceId) - Number(a.mark.traceId === selectedTraceId) ||
			CLASS_RANK[captionClass(a.mark, linked)] - CLASS_RANK[captionClass(b.mark, linked)] ||
			b.mark.start - a.mark.start ||
			a.mark.id.localeCompare(b.mark.id)
	);

/**
 * A caption at rest holds at most `max` characters: a longer text is cut at the last
 * word boundary within them and ends with «…». A boundary earlier than
 * `CAPTION_MIN_CUT_CHARS` would leave a stub, so the text is cut hard at the limit instead.
 */
export const truncateCaption = (text: string, max: number = CAPTION_MAX_CHARS): string => {
	const chars = Array.from(text);
	if (chars.length <= max) return text;
	let boundary = -1;
	for (let i = max; i >= 0; i -= 1) {
		if (/\s/.test(chars[i])) {
			boundary = i;
			break;
		}
	}
	const cut = boundary >= CAPTION_MIN_CUT_CHARS ? boundary : max;
	return `${chars.slice(0, cut).join('').trimEnd()}…`;
};

/** Both ends of every explicit link, by traceId: the facts among them rank before other facts. */
export const linkedTraceIds = (links: readonly TraceLink[]): ReadonlySet<string> => {
	const ids = new Set<string>();
	for (const link of links) ids.add(link.fromTraceId).add(link.toTraceId);
	return ids;
};
