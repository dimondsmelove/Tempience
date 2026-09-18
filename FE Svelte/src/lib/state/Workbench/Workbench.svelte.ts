import { locale } from '$lib/state/Locale/Locale.svelte';
import type { Locale } from '$lib/state/Locale/types';
import { displayedTrace } from '$lib/state/Workbench/display';
import { errorText } from '$lib/state/Locale/errors';
import { SvelteDate } from 'svelte/reactivity';
import { scopeContext } from '$lib/model/ScopeContext/ScopeContext';
import type { PeriodRef } from '$lib/model/Axis/types';
import { countInWindow, projectSnapshot, traceRange } from '$lib/model/Projection/Projection';
import type { Projection, ProjectionState, TimeRange } from '$lib/model/Projection/types';
import { FormsState } from '$lib/state/Forms/Forms.svelte';
import type { FormCapturePreset } from '$lib/state/Forms/types';
import { FiltersState } from '$lib/state/Filters/Filters.svelte';
import { RowsState } from '$lib/state/Rows/Rows.svelte';
import { SelectionState } from '$lib/state/Selection/Selection.svelte';
import { UndoState } from '$lib/state/Undo/Undo.svelte';
import type { ExitGuard } from '$lib/state/TraceDraft/types';
import type { SelectSource } from '$lib/state/Selection/types';
import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import {
	applyReview,
	decide,
	importProposalSet,
	markApplied,
	parsePreviewId,
	parseProposalSet,
	proposalCounts,
	proposalDecisions,
	proposalItems,
	proposalSnapshot
} from '$lib/model/Proposals/Proposals';
import { PROPOSALS_STORAGE_KEY } from '$lib/model/Proposals/constants';
import type {
	ProposalCounts,
	ProposalDecision,
	ProposalItem,
	ProposalSet
} from '$lib/model/Proposals/types';
import { prepareScenarioImport } from '$lib/scenarios/belgrade/scenario-import';
import type { DataSpace } from '$lib/state/triplit/data-space';
import type { ScenarioImportRepository } from '$lib/state/triplit/scenario-import-repository';
import { mergeExplorerSnapshots } from '$lib/model/Snapshot/Snapshot';
import { periodTimeBounds } from '$lib/state/triplit/period-time';
import type { ExplorerEntity, ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { EMPTY_SNAPSHOT } from './constants';

export type WorkbenchStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Records of one date the canvas could not tell apart; the Context lists them (DESIGN.md §5, §8). */
export type SlotList = Readonly<{ range: TimeRange; traceIds: readonly string[] }>;

/**
 * Thin store over the Time surface: the snapshot, the child stores and the
 * projection derived from them. Commands from the canvas, the twin and the
 * toolbar land here; the window moves only for choices made off the canvas.
 */
export class WorkbenchState {
	snapshot = $state.raw<ExplorerSnapshot>(EMPTY_SNAPSHOT);
	status = $state<WorkbenchStatus>('idle');
	/** The cause of a failed load, or null; `error` is its words in the language of the moment. */
	failure = $state.raw<unknown>(null);
	get error(): string | null {
		return this.failure === null ? null : errorText(this.failure);
	}
	/**
	 * A record was committed while a table or a catalog stood in the centre: the timeline
	 * behind it was not read again, and is read again when it is shown again.
	 */
	stale = $state(false);
	/**
	 * How many snapshots the loader has answered with. Readers that read a record again once
	 * the timeline is reloaded key on this: a redisplay in another language is not a load.
	 */
	loaded = $state(0);
	/** «Записать» is open in the Context. */
	capture = $state(false);
	slot = $state.raw<SlotList | null>(null);
	/** The manifest under review; its open candidates join the snapshot as proposals (DP15). */
	proposals = $state.raw<ProposalSet | null>(null);
	readonly viewport: ViewportState;
	readonly rows = new RowsState();
	readonly selection = new SelectionState();
	readonly filters = new FiltersState();
	readonly forms = new FormsState();
	// The offer belongs to the space whose records it would act on; the app names it.
	readonly undo = new UndoState();
	/** Asked before a command ends what the Context shows; the app installs the draft guard. */
	exitGuard: ExitGuard = { exit: (then) => then() };
	/** A Trace form («Записать» or an edit) is open; the Context stays alive for it. */
	readonly formOpen = $derived(this.capture || this.forms.editingId !== null);

	/** The live snapshot plus the preview of the proposals: what the ribbon and the Context read. */
	readonly view: ExplorerSnapshot = $derived(
		this.proposals
			? mergeExplorerSnapshots(this.snapshot, proposalSnapshot(this.proposals, this.snapshot))
			: this.snapshot
	);
	readonly proposalItems: readonly ProposalItem[] = $derived(
		this.proposals ? proposalItems(this.proposals) : []
	);
	readonly proposalCounts: ProposalCounts = $derived(
		this.proposals
			? proposalCounts(this.proposals)
			: { pending: 0, accepted: 0, deferred: 0, excluded: 0, applied: 0 }
	);

	/** Everything the projection reads apart from the disclosure. */
	readonly projectionInputs: Omit<ProjectionState, 'expanded'> = $derived({
		hiddenScopes: this.filters.hiddenScopes,
		onlyScopes: this.filters.onlyScopes,
		hiddenLegend: this.filters.hiddenLegend,
		shownKindIds: this.filters.shownKindIds,
		scopeQuery: this.filters.scopeQuery,
		grouping: this.rows.grouping,
		language: locale.current,
		proposals: this.proposals ? proposalDecisions(this.proposals) : undefined
	});
	readonly projection: Projection = $derived(
		projectSnapshot(this.view, { ...this.projectionInputs, expanded: this.rows.expanded })
	);

	readonly scopeContext = $derived(
		this.selection.scopeId ? scopeContext(this.view, this.selection.scopeId) : null
	);

	constructor(viewport: ViewportState) {
		this.viewport = viewport;
	}

	/** Whether the timeline is behind a Kind's table: a reload for it can wait. */
	get timelineCovered(): boolean {
		return this.forms.data !== null;
	}

	markStale(): void {
		this.stale = true;
	}

	/** The typed records' display in another language, without reading anything again. */
	redisplay(language: Locale): void {
		const catalog = this.snapshot.catalog;
		if (!catalog) return;
		this.snapshot = {
			...this.snapshot,
			traces: this.snapshot.traces.map((trace) => displayedTrace(trace, catalog, language))
		};
	}

	async load(loader: () => Promise<ExplorerSnapshot>): Promise<void> {
		this.status = 'loading';
		this.failure = null;
		this.stale = false;
		try {
			this.snapshot = await loader();
			this.loaded += 1;
			this.status = 'ready';
		} catch (cause: unknown) {
			this.failure = cause ?? new Error();
			this.status = 'error';
		}
	}

	/** Distinct records whose marks touch the window. */
	get inWindow(): number {
		return countInWindow(this.projection, this.viewport.window);
	}

	/** The time the current selection occupies on the ribbon, if any. */
	get selectedRange(): TimeRange | null {
		const current = this.selection.current;
		if (!current) return null;
		if (current.kind === 'period') return { start: current.period.start, end: current.period.end };
		if (current.kind === 'scope') return this.scopeContext?.range ?? null;
		if (current.kind === 'intersection') return null;
		if (current.kind === 'period-record') {
			const record = this.view.periods.find((item) => item.id === current.periodId);
			return record ? periodTimeBounds(record.time, record.timezone) : null;
		}
		return traceRange(this.projection, current.traceId);
	}

	/** What the Context shows ends here: the open form's guard first, then the slot and forms close. */
	private leave(then: () => void): void {
		this.exitGuard.exit(() => {
			this.slot = null;
			this.closeForms();
			this.forms.open = false;
			then();
		});
	}

	/** Ends the open Trace form; callers pass the exit guard first. */
	closeForms(): void {
		this.capture = false;
		this.forms.editingId = null;
		this.forms.newScope = null;
	}

	/** DP7: a choice made on the ribbon, by pointer or through its DOM twin, leaves the window alone. */
	selectTrace(traceId: string, source: SelectSource): void {
		this.leave(() => {
			this.selection.select({ kind: 'trace', traceId }, source);
			if (source !== 'canvas' && source !== 'twin') this.revealSelected();
		});
	}

	selectScope(scopeId: string, source: SelectSource = 'rail'): void {
		this.leave(() => {
			this.selection.select({ kind: 'scope', scopeId }, source);
			this.revealSelected();
		});
	}

	selectIntersection(intersectionId: string, source: SelectSource = 'context'): void {
		this.leave(() => this.selection.select({ kind: 'intersection', intersectionId }, source));
	}

	selectEntity(entity: ExplorerEntity): void {
		if (entity.role === 'trace') this.selectTrace(entity.record.id, 'context');
		else if (entity.role === 'scope') this.selectScope(entity.record.id, 'context');
		else if (entity.role === 'intersection') this.selectIntersection(entity.record.id);
		else if (entity.role === 'period') {
			this.leave(() => {
				this.selection.select({ kind: 'period-record', periodId: entity.record.id }, 'context');
				this.revealSelected();
			});
		}
	}

	selectPeriod(period: PeriodRef, source: SelectSource = 'axis'): void {
		this.leave(() => {
			this.selection.select({ kind: 'period', period }, source);
			this.revealSelected();
		});
	}

	back(): void {
		this.leave(() => {
			this.selection.back();
			this.revealSelected();
		});
	}

	forward(): void {
		this.leave(() => {
			this.selection.forward();
			this.revealSelected();
		});
	}

	/** Покой: the selection steps aside but stays in history; the slot list belongs to it and closes. */
	rest(): void {
		this.leave(() => this.selection.rest());
	}

	/** Entity navigation fits its full time; calendar-axis selection preserves the working scale. */
	revealSelected(): void {
		const range = this.selectedRange;
		if (!range) return;
		if (this.selection.period) this.viewport.reveal(range.start, range.end);
		else this.viewport.fit(range.start, range.end);
	}

	/** «К выбранному» frames the full selected object, including one already in view. */
	goToSelected(): void {
		const range = this.selectedRange;
		if (range) this.viewport.fit(range.start, range.end);
	}

	/** A click on a pile of records closes in on their range; at the limit it picks the top one. */
	zoomToCluster(range: TimeRange, traceIds: readonly string[]): void {
		const span = Math.max(range.end - range.start, 0);
		if (
			span <= this.viewport.limits.minSpanMs / 2 ||
			this.viewport.spanMs <= this.viewport.limits.minSpanMs
		) {
			this.leave(() => {
				this.selection.select({ kind: 'trace', traceId: traceIds[0] }, 'canvas');
				if (traceIds.length > 1) this.slot = { range, traceIds };
			});
			return;
		}
		this.viewport.fit(range.start, range.end);
	}

	/** Each «Записать» is a new opening: an open form ends first, through its guard. */
	openCapture(preset?: FormCapturePreset): void {
		this.exitGuard.exit(() => {
			this.forms.capture(preset);
			this.forms.open = false;
			this.forms.editingId = null;
			this.capture = true;
		});
	}

	/** A Scope of its own, made in the Context: from the rail as a root, from a Scope as its child. */
	createScope(parentId: string | null): void {
		this.exitGuard.exit(() => {
			this.closeForms();
			this.forms.open = false;
			this.forms.newScope = { parentId };
		});
	}

	closeCapture(): void {
		this.exitGuard.exit(() => {
			this.capture = false;
			this.forms.open = false;
		});
	}

	/** The candidate behind a proposed record on the ribbon, if the id is one. */
	proposalOf(traceId: string): string | null {
		const parsed = parsePreviewId(traceId);
		return parsed && parsed.manifestId === this.proposals?.manifest.manifestId
			? parsed.candidateId
			: null;
	}

	private persistProposals(storage: Storage | null): void {
		if (!storage) return;
		if (this.proposals) storage.setItem(PROPOSALS_STORAGE_KEY, JSON.stringify(this.proposals));
		else storage.removeItem(PROPOSALS_STORAGE_KEY);
	}

	restoreProposals(storage: Storage | null): void {
		try {
			const raw = storage?.getItem(PROPOSALS_STORAGE_KEY);
			this.proposals = raw ? parseProposalSet(JSON.parse(raw)) : null;
		} catch {
			this.proposals = null;
		}
	}

	/** DP19: a manifest file becomes the set under review; a new file replaces the old set. */
	importProposals(json: string, storage: Storage | null): void {
		this.proposals = importProposalSet(json, new SvelteDate().toISOString());
		this.persistProposals(storage);
	}

	decideProposals(
		candidateIds: readonly string[],
		decision: ProposalDecision,
		note?: string,
		storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage
	): void {
		if (!this.proposals) return;
		this.proposals = decide(this.proposals, candidateIds, decision, note);
		this.persistProposals(storage);
	}

	clearProposals(storage: Storage | null): void {
		this.proposals = null;
		this.persistProposals(storage);
	}

	/**
	 * DP18: the accepted records with their Scopes and links are written to the
	 * scenario DataSpace in one batch; the selection follows the applied record.
	 */
	async applyProposals(
		repository: ScenarioImportRepository,
		target: DataSpace,
		loader: () => Promise<ExplorerSnapshot>,
		storage: Storage | null
	): Promise<void> {
		if (!this.proposals || target.kind !== 'scenario') return;
		const { review, candidateIds } = applyReview(this.proposals);
		if (candidateIds.length === 0) return;
		const batch = prepareScenarioImport({ manifest: this.proposals.manifest, review, target });
		const receipt = await repository.apply(batch);
		const selected = this.selection.traceId ? this.proposalOf(this.selection.traceId) : null;
		this.proposals = markApplied(this.proposals, candidateIds);
		this.persistProposals(storage);
		await this.load(loader);
		const appliedId = selected ? receipt.mapping[selected] : undefined;
		if (appliedId) this.selection.select({ kind: 'trace', traceId: appliedId }, 'canvas');
	}
}
