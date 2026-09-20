import type { Mark } from '$lib/model/Projection/types';
import { SEARCH_DIM_ALPHA } from '$lib/model/Search/constants';
import { captionStart } from './anchor';
import { FORCED_CAPTION_GAP_PX } from './constants';
import type { Caption, CaptionOptions, CaptionRow, Emphasis, LabelBox, MarkBox } from './types';

type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

const overlaps = (a: Rect, b: Rect): boolean =>
	a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const boxRect = (box: MarkBox): Rect => ({
	x: box.x0,
	y: box.y0,
	width: box.x1 - box.x0,
	height: box.y1 - box.y0
});

/** The rect a forced caption claims: its text plus the room its plate takes on either side. */
const claimed = (label: LabelBox): Rect => ({
	x: label.x - FORCED_CAPTION_GAP_PX,
	y: label.y,
	width: label.width + 2 * FORCED_CAPTION_GAP_PX,
	height: label.height
});

/**
 * How a record stands out right now (research п. 4, 5, 9): the selected and
 * the lit (hovered) record are strong — full force, bold caption — and their
 * captions are forced, as are the captions of the records a search matches.
 * A record the search does not match is dim, unless it is lit or selected:
 * the pointer always reveals what it rests on.
 */
export const emphasisOf = (
	traceId: string,
	options: Pick<CaptionOptions, 'selectedTraceId' | 'lit' | 'dimmed' | 'searching'>
): Emphasis => {
	const strong = traceId === options.selectedTraceId || options.lit.has(traceId);
	const dim = !strong && options.dimmed.has(traceId);
	return { strong, dim, forced: strong || (options.searching && !dim) };
};

/** The text of a forced caption: what the record says in full — a closed intention with its closing day (C4). */
export const forcedText = (mark: Pick<Mark, 'label' | 'forcedLabel'>): string =>
	mark.forcedLabel ?? mark.label;

/** A caption on its way to the canvas: the layout's, or one the emphasis adds. */
type Entry = Readonly<{
	label: LabelBox;
	traceId: string;
	emphasis: Emphasis;
	/** Placed by the layout (within the budget), as against added here by the emphasis. */
	layout: boolean;
	/** Where the record starts on the canvas: «поздняя уступает» reads the record, not its caption. */
	x: number;
}>;

/**
 * Placement rank: the selected record, then the captions the layout placed at
 * rest — a focus or a lens reveals more, never less — then the forced captions
 * the emphasis adds, hovered, lit or matched alike. Unforced captions last; they
 * never yield.
 */
const rank = (entry: Entry, selectedTraceId: string | null): number =>
	entry.traceId === selectedTraceId ? 0 : !entry.emphasis.forced ? 5 : entry.layout ? 1 : 2;

/** Among equals the earlier record wins: the one that starts further left on the canvas (DESIGN §5 «поздняя уступает»). */
const earlier = (a: Entry, b: Entry): number => a.x - b.x || a.label.x - b.label.x;

/**
 * The captions of one row as they draw: the captions the layout placed, plus
 * the forced captions of the selected, lit and matching records the collision
 * rule, the budget or the tier left out — drawn anyway, on a backing when they
 * overlap a neighbour's mark or another caption (п. 5). A caption the layout cut
 * to `CAPTION_MAX_CHARS` reads in full while its record is forced (Q1-A п. 2),
 * so a hover on a row's name shows every caption of the row in full (п. 4); a
 * forced caption says what the record has to say in full — a closed intention
 * adds its closing day (`forcedLabel`, loop 008 C4).
 * Forced captions never cover each other, plates included: the later record
 * yields — the one whose mark starts further right, whatever its caption's x
 * and whether a hover, a focus or a search forced it (loop 008 review) — so a
 * lit row does not become a pile of text; a caption the layout placed at rest
 * is never taken away by one the emphasis adds. Strong captions draw bold and
 * are measured so. Pure over the layout, so a hover or a keystroke costs one
 * redraw and no layout.
 */
export const resolveCaptions = (row: CaptionRow, options: CaptionOptions): Caption[] => {
	const { measure, fontPx, widthPx, selectedTraceId } = options;
	const measureStrong = options.measureStrong ?? measure;
	const widthOf = (text: string, emphasis: Emphasis): number =>
		emphasis.strong ? measureStrong(text) : measure(text);
	const boundedY = (y: number): number => Math.max(row.y0, Math.min(y, row.y1 - fontPx));
	const boxById = new Map(row.boxes.map((box) => [box.mark.id, box]));
	const entries: Entry[] = [];
	for (const label of row.labels) {
		const box = boxById.get(label.markId);
		const traceId = box?.mark.traceId ?? '';
		const emphasis = emphasisOf(traceId, options);
		const text = box && emphasis.forced ? forcedText(box.mark) : label.text;
		const full =
			text !== label.text || emphasis.strong
				? { ...label, text, width: widthOf(text, emphasis) }
				: label;
		entries.push({ label: full, traceId, emphasis, layout: true, x: box?.x0 ?? label.x });
	}
	const captioned = new Set(row.labels.map((label) => label.markId));
	for (const box of row.boxes) {
		if (captioned.has(box.mark.id) || box.x1 > widthPx || box.x0 < -widthPx) continue;
		const emphasis = emphasisOf(box.mark.traceId, options);
		if (!emphasis.forced) continue;
		const text = forcedText(box.mark);
		const width = widthOf(text, emphasis);
		const label: LabelBox = {
			markId: box.mark.id,
			text,
			x: captionStart(box),
			y: boundedY((box.y0 + box.y1) / 2 - fontPx / 2),
			width,
			height: fontPx,
			selected: box.mark.traceId === selectedTraceId
		};
		if (label.x + width < 0) continue;
		entries.push({ label, traceId: box.mark.traceId, emphasis, layout: false, x: box.x0 });
	}
	entries.sort((a, b) => rank(a, selectedTraceId) - rank(b, selectedTraceId) || earlier(a, b));
	const placed: Entry[] = [];
	for (const entry of entries) {
		if (
			entry.emphasis.forced &&
			placed.some(
				(other) => other.emphasis.forced && overlaps(claimed(other.label), claimed(entry.label))
			)
		)
			continue;
		placed.push(entry);
	}
	// The draw order: unforced captions first, then the forced, the selected on top.
	placed.sort((a, b) => rank(b, selectedTraceId) - rank(a, selectedTraceId) || earlier(a, b));
	return placed.map(({ label, traceId, emphasis }) => ({
		label,
		strong: emphasis.strong,
		alpha: emphasis.dim ? SEARCH_DIM_ALPHA : 1,
		backing:
			emphasis.forced &&
			(placed.some((other) => other.label !== label && overlaps(other.label, label)) ||
				row.boxes.some((box) => box.mark.traceId !== traceId && overlaps(boxRect(box), label)))
	}));
};
