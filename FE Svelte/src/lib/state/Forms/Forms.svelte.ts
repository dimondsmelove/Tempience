import { KindHistoryState } from '$lib/state/KindHistory/KindHistory.svelte';
import type { FormTarget, FormCapturePreset } from './types';

/** Transient form navigation; published definitions and records stay in the repository. */
export class FormsState {
	open = $state(false);
	kindId = $state<string | undefined>();
	revision = $state(0);
	data = $state<FormTarget | null>(null);
	/**
	 * The history of the Kind shown last, as the user left it — filters, pages, columns — kept
	 * across the timeline and the Context, so coming back to the Kind finds it the same.
	 */
	history = $state<KindHistoryState | null>(null);
	capturePreset = $state<FormCapturePreset | undefined>();
	/** Counts openings of «Записать»: each one is a fresh form, never the previous input. */
	captureRevision = $state(0);
	/** The record whose edit form is open in the Context, if any. */
	editingId = $state<string | null>(null);
	/**
	 * What a new Kind starts with when the catalog opens to make one: the Scope it was asked
	 * from, shown as its membership and changeable there. Null when the catalog opens as itself.
	 */
	newKindScopeIds = $state.raw<readonly string[] | null>(null);
	/** A new Scope being made in the Context, with the parent it starts under; null when none. */
	newScope = $state<{ parentId: string | null } | null>(null);
	/**
	 * The Kind of the catalog «Записать» was pressed in, if it was: cancelling the form goes
	 * back to that Kind instead of leaving the Context empty (owner, 2026-09-18).
	 */
	captureReturn = $state<string | null>(null);

	/** The Scope the history is filtered by: what «Записать» from it starts with. */
	get scopeId(): string {
		return this.history?.filters.scope?.id ?? '';
	}

	showCatalog(kindId?: string): void {
		this.kindId = kindId;
		this.newKindScopeIds = null;
		this.open = true;
		this.revision += 1;
	}
	/** The catalog, open on the constructor of a new Kind with these memberships shown. */
	createKind(scopeIds: readonly string[]): void {
		this.kindId = undefined;
		this.newKindScopeIds = [...scopeIds];
		this.open = true;
		this.revision += 1;
	}
	capture(preset?: FormCapturePreset): void {
		this.capturePreset = preset;
		this.captureRevision += 1;
	}
	/** The Kind's history in the centre; another Kind's starts unfiltered, the same one's as left. */
	showHistory(kindId: string, versionId?: string): void {
		if (this.history?.kindId !== kindId) this.history = new KindHistoryState(kindId);
		this.data = { kindId, ...(versionId ? { versionId } : {}) };
	}
	/** Kept for the catalog's «История»: the same entry as `showHistory`. */
	showData(kindId: string, versionId: string): void {
		this.showHistory(kindId, versionId);
	}
	/** Back to the timeline; the history of the Kind is kept for its next opening. */
	showTimeline(): void {
		this.data = null;
	}
}
