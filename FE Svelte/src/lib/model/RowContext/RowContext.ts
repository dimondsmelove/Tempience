import { MERGED_ROW_ID_JOINER } from '$lib/model/Arrangement/constants';
import type { LensView } from '$lib/model/Lens/types';
import { UNSCOPED_ROW_ID } from '$lib/model/Projection/constants';
import { scopeMembership } from '$lib/model/Projection/tree';
import type { ProjectedRow } from '$lib/model/Projection/types';
import type { RowContext, RowMember, RowRecord } from './types';

/** The members a merged row shows, in lane order, read from its id — a Scope id never carries the joiner. */
export const rowMemberIds = (row: Pick<ProjectedRow, 'id'>): string[] =>
	row.id.split(MERGED_ROW_ID_JOINER);

/**
 * What the Context shows for a merged row (loop 008, C5): its name, its members as chips,
 * `n · Σ m` as the rail counts them, and every record it draws once, by time — the list the
 * period shows, without the Scopes in the row. Pure over the projected row and the snapshot.
 */
export const rowContext = (row: ProjectedRow, view: LensView, unscopedName: string): RowContext => {
	const seen = new Set<string>();
	const records: RowRecord[] = [];
	for (const mark of row.marks) {
		if (seen.has(mark.traceId)) continue;
		seen.add(mark.traceId);
		records.push({ traceId: mark.traceId, label: mark.label, start: mark.start });
	}
	records.sort((a, b) => a.start - b.start || a.traceId.localeCompare(b.traceId));
	const members = rowMemberIds(row).map((id): RowMember => {
		if (id === UNSCOPED_ROW_ID) {
			const membership = scopeMembership(view.traces, view.scopes, view.intersections);
			const traceIds = records
				.map((record) => record.traceId)
				.filter((traceId) => (membership.scopesByTrace.get(traceId)?.size ?? 0) === 0);
			return {
				id,
				name: unscopedName,
				colorHue: null,
				colorChroma: null,
				lens: { kind: 'traces', traceIds }
			};
		}
		const scope = view.scopes.find((item) => item.id === id);
		return {
			id,
			name: scope?.name ?? id,
			colorHue: scope?.colorHue ?? null,
			colorChroma: scope?.colorChroma ?? null,
			colorDepth: scope?.colorDepth ?? null,
			lens: { kind: 'scope', scopeId: id }
		};
	});
	return {
		id: row.id,
		name: row.name,
		expanded: row.expanded,
		members,
		directCount: row.directCount,
		subtreeCount: row.subtreeCount,
		records
	};
};
