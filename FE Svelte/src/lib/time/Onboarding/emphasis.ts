export type EmphasisKind = 'text' | 'strong' | 'em' | 'code';
/** A stretch of copy rendered one way; `start` is its offset in the source and keys it. */
export type EmphasisRun = {
	readonly start: number;
	readonly kind: EmphasisKind;
	readonly text: string;
};

/** `**strong**`, `*em*` and `` `code` `` marks; a mark without its closing twin is plain text. */
const MARKS = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;

/**
 * Splits catalog copy into runs so the template renders emphasis with elements, not HTML.
 * Marks do not nest: the first mark at a position wins, and its text is taken literally.
 */
export const parseEmphasis = (source: string): EmphasisRun[] => {
	const runs: EmphasisRun[] = [];
	let cursor = 0;
	for (const match of source.matchAll(MARKS)) {
		const start = match.index ?? 0;
		if (start > cursor)
			runs.push({ start: cursor, kind: 'text', text: source.slice(cursor, start) });
		const [strong, em, code] = [match[1], match[2], match[3]];
		if (strong !== undefined) runs.push({ start, kind: 'strong', text: strong });
		else if (em !== undefined) runs.push({ start, kind: 'em', text: em });
		else if (code !== undefined) runs.push({ start, kind: 'code', text: code });
		cursor = start + match[0].length;
	}
	if (cursor < source.length)
		runs.push({ start: cursor, kind: 'text', text: source.slice(cursor) });
	return runs;
};
