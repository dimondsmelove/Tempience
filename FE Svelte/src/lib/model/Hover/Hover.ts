import type { Hit } from '$lib/model/HitTest/types';
import type { RowLayout } from '$lib/model/Layout/types';
import type { HoverTarget } from './types';

/**
 * What a hit on the canvas hovers (owner review 2026-09-19, п. 14/15): the record
 * under a mark or under its caption, and nothing else. The empty band of a row is
 * no target — a row is hovered by its name in the rail alone, so the pointer
 * crossing the ribbon lights no row's records.
 */
export const canvasHover = (hit: Hit | null, rows: readonly RowLayout[]): HoverTarget => {
	if (!hit) return null;
	if (hit.type === 'mark') return { kind: 'trace', traceId: hit.boxes[0].mark.traceId };
	if (hit.type !== 'label') return null;
	const box = rows
		.flatMap((row) => row.boxes)
		.find((candidate) => candidate.mark.id === hit.label.markId);
	return box ? { kind: 'trace', traceId: box.mark.traceId } : null;
};

/** One string per target — `trace:id`, `period:month:1700000000000` — and empty for none; what the canvas says in `data-hover`. */
export const hoverKey = (target: HoverTarget): string => {
	if (!target) return '';
	switch (target.kind) {
		case 'trace':
			return `trace:${target.traceId}`;
		case 'row':
			return `row:${target.rowId}`;
		case 'scope':
			return `scope:${target.scopeId}`;
		case 'period':
			return `period:${target.period.unit}:${target.period.start}`;
		case 'traces':
			return `traces:${target.traceIds.join(',')}`;
		case 'kind':
			return `kind:${target.kindId}`;
	}
};

/** Two hover targets are the same thing under the pointer. */
export const sameHover = (a: HoverTarget, b: HoverTarget): boolean =>
	a === b || hoverKey(a) === hoverKey(b);
