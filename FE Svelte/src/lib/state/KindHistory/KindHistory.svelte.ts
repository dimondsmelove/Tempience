import type { KindIndexRequest, KindIndexSnapshot } from '$lib/state/triplit/trace-dataset';
import type { TraceKindV } from '$lib/state/triplit/types';
import { FIRST, UNCONSTRAINED } from './constants';
import { clampPage, placeByVersion } from './order';
import type { HistoryFilters, VersionPages, VersionRows } from './types';

/**
 * The history of one Kind as the user left it: its filters, the page and open groups of every
 * version's table, the columns each table shows, and where it was scrolled to. It outlives
 * the surface that shows it, so a record read or edited on the right returns to the same
 * table; nothing of it is cleared by navigation. The index — every active record of the Kind
 * under the Scope and value filters, thin — is subscribed by the surface and kept here; the
 * versions, the period, the order and the pages are decided on it, never by another read.
 */
export class KindHistoryState {
	readonly kindId: string;
	filters = $state<HistoryFilters>(UNCONSTRAINED);
	pages = $state<Record<string, VersionPages>>({});
	/** Per version: the keys of the columns shown; a version not named shows every column. */
	columns = $state<Record<string, readonly string[]>>({});
	/** Per version: the projection chosen where the schema offers several (repeated groups). */
	projections = $state<Record<string, string>>({});
	scrollTop = $state(0);
	index = $state.raw<KindIndexSnapshot | null>(null);

	constructor(kindId: string) {
		this.kindId = kindId;
	}

	/** What the index is subscribed with: the Kind under the Scope and value filters. */
	readonly indexRequest: KindIndexRequest = $derived.by(() => ({
		kindId: this.kindId,
		...(this.filters.scope ? { scope: this.filters.scope } : {}),
		...(this.filters.values.length ? { filters: this.filters.values } : {})
	}));

	/** The rows of every version under the period, ordered; null until the index has answered. */
	readonly placement: ReadonlyMap<string, VersionRows> | null = $derived.by(() =>
		this.index?.status === 'ready'
			? placeByVersion(this.index.rows, { from: this.filters.from, to: this.filters.to })
			: null
	);

	/** How many explicit filters apply, beside the versions. */
	readonly activeFilters: number = $derived(
		Number(this.filters.scope !== null) +
			Number(this.filters.from !== '' || this.filters.to !== '') +
			this.filters.values.length +
			Number(this.filters.versionIds !== null)
	);

	/** The versions shown, newest first: those the filter names, or every one. */
	shown(versions: readonly TraceKindV[]): TraceKindV[] {
		const named = this.filters.versionIds;
		return versions
			.filter((version) => named === null || named.includes(version.id))
			.toSorted((a, b) => b.generation - a.generation || b.createdAt.localeCompare(a.createdAt));
	}

	rowsOf(versionId: string): VersionRows {
		return this.placement?.get(versionId) ?? { dated: [], undated: [] };
	}

	pagesOf(versionId: string): VersionPages {
		const pages = this.pages[versionId] ?? FIRST;
		const rows = this.rowsOf(versionId);
		// A page kept from before the rows shrank is the last one there is now.
		return {
			...pages,
			dated: clampPage(pages.dated, rows.dated.length),
			undated: clampPage(pages.undated, rows.undated.length)
		};
	}

	setPage(versionId: string, group: 'dated' | 'undated', page: number): void {
		this.pages = { ...this.pages, [versionId]: { ...this.pagesOf(versionId), [group]: page } };
	}

	toggleUndated(versionId: string): void {
		const pages = this.pagesOf(versionId);
		this.pages = { ...this.pages, [versionId]: { ...pages, undatedOpen: !pages.undatedOpen } };
	}

	setColumns(versionId: string, keys: readonly string[]): void {
		this.columns = { ...this.columns, [versionId]: keys };
	}

	setProjection(versionId: string, projectionId: string): void {
		this.projections = { ...this.projections, [versionId]: projectionId };
	}

	/** A changed filter changes what every page holds: every table starts at its first page. */
	setFilters(change: Partial<HistoryFilters>): void {
		this.filters = { ...this.filters, ...change };
		this.pages = Object.fromEntries(
			Object.entries(this.pages).map(([id, pages]) => [id, { ...pages, dated: 0, undated: 0 }])
		);
	}

	reset(): void {
		this.setFilters(UNCONSTRAINED);
	}
}
