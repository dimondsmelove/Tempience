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
import { filterCounts } from '$lib/model/FilterCounts/FilterCounts';
import type { FilterCounts } from '$lib/model/FilterCounts/types';
import { HoverState } from '$lib/state/Hover/Hover.svelte';
import type { LitSet } from '$lib/model/Hover/types';
import { lensSet } from '$lib/model/Lens/Lens';
import type { LensSet } from '$lib/model/Lens/types';
import { focusSet, unionLit } from '$lib/model/Focus/Focus';
import type { FocusKind, FocusSet, FocusTarget } from '$lib/model/Focus/types';
import { PULSE_MS } from '$lib/model/Pulse/constants';
import { pulseSet } from '$lib/model/Pulse/Pulse';
import type { CanvasPulse, Pulse } from '$lib/model/Pulse/types';
import { dimmedTraceIds, normalizeQuery } from '$lib/model/Search/Search';
import { RowsState } from '$lib/state/Rows/Rows.svelte';
import { ArrangementState } from '$lib/state/Arrangement/Arrangement.svelte';
import { laneIds } from '$lib/model/Arrangement/Arrangement';
import { SelectionState, selectionKey } from '$lib/state/Selection/Selection.svelte';
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
	/** The rows as arranged on this device (research п. 7): lanes over the Scopes of the view; the app binds its store. */
	readonly arrangement = new ArrangementState(() => laneIds(this.view));
	readonly selection = new SelectionState();
	readonly filters = new FiltersState();
	readonly hover = new HoverState();
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
		soloLegend: this.filters.soloLegend,
		// «Просроченное» is decided at the projection's last build; the line «сейчас» itself moves on the canvas.
		now: Date.now(),
		shownKindIds: this.filters.shownKindIds,
		scopeQuery: this.filters.scopeQuery,
		grouping: this.rows.grouping,
		language: locale.current,
		proposals: this.proposals ? proposalDecisions(this.proposals) : undefined,
		arrangement: this.arrangement.current
	});
	readonly projection: Projection = $derived(
		projectSnapshot(this.view, { ...this.projectionInputs, expanded: this.rows.expanded })
	);
	/** The numbers beside the filter items (loop 008, C7): each Kind's records in the view, each hidden Scope's `n · Σ m`. */
	readonly filterCounts: FilterCounts = $derived(filterCounts(this.view, this.projectionInputs));

	readonly scopeContext = $derived(
		this.selection.scopeId ? scopeContext(this.view, this.selection.scopeId) : null
	);

	/**
	 * The lens (loop 008, B): what the hover draws above the veil — the record with its
	 * projections and the records linked to it, a row's records, a Scope's, a period's — and
	 * the rows named in bold.
	 */
	readonly lens: LensSet = $derived(
		lensSet(this.hover.target, this.projection.rows, this.projection.links, this.view)
	);
	/** What the Context shows, as the ribbon reads it (loop 008, A): a persisted Period by its time, a merged row by its id (C5); nothing at rest. */
	readonly focusTarget: FocusTarget = $derived.by(() => {
		const current = this.selection.current;
		if (!current) return null;
		if (current.kind === 'period')
			return { kind: 'period', range: { start: current.period.start, end: current.period.end } };
		if (current.kind === 'row') return { kind: 'row', rowId: current.rowId };
		if (current.kind === 'period-record') {
			const record = this.view.periods.find((item) => item.id === current.periodId);
			return record
				? { kind: 'period', range: periodTimeBounds(record.time, record.timezone) }
				: null;
		}
		return current;
	});
	/** The kind in focus, for the surface's `data-focus`; empty at rest. */
	readonly focusKind: FocusKind = $derived(this.focusTarget?.kind ?? '');
	/** What the focus keeps lit under no veil: a period's column and records, a Scope's records, a link's ends. */
	readonly focus: FocusSet = $derived(focusSet(this.focusTarget, this.projection.rows, this.view));
	/** Everything in full force with its caption forced, and the rows named in bold: the focus and the lens as one. */
	readonly lit: LitSet = $derived(unionLit(this.focus, this.lens));
	/**
	 * «Куда смотреть» (loop 008, C3): a choice made in the Context or through its history rings
	 * the record on the ribbon and flashes its name in the rail, once; null when none is running.
	 */
	pulse = $state.raw<Pulse | null>(null);
	private pulseTimer: ReturnType<typeof setTimeout> | undefined;
	/** What the pulse points at, as the rows draw it: the records to ring, the rows whose names flash. */
	readonly pulseSet: LitSet = $derived(
		pulseSet(this.pulse?.target ?? null, this.projection.rows, this.view)
	);
	/** The pulse as the canvas reads it, or null: its identity and the records to ring. */
	readonly canvasPulse: CanvasPulse | null = $derived(
		this.pulse ? { key: this.pulse.key, at: this.pulse.at, traceIds: this.pulseSet.traceIds } : null
	);
	/** A record search is on: the misses dim on the ribbon and the overview, the matches' captions are forced (п. 9). */
	readonly searching: boolean = $derived(normalizeQuery(this.filters.recordQuery) !== '');
	/** Records the search does not match, by id; empty without a search. Visual only: rows and layout stay. */
	readonly dimmed: ReadonlySet<string> = $derived(
		dimmedTraceIds(this.filters.recordQuery, this.view.traces)
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
		if (current.kind === 'row')
			return this.projection.rows.find((row) => row.id === current.rowId)?.range ?? null;
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

	/**
	 * The Context closes (owner review 2026-09-19, pack 4, D): what it showed ends — the slot
	 * list, the open form — and the selection steps aside with it (DP7 «Снять выбор»), so a
	 * closed Context leaves no ring on the ribbon. The history stays: «→» brings the record
	 * back. Callers pass the exit guard first.
	 */
	closeContext(): void {
		this.slot = null;
		this.closeForms();
		this.selection.rest();
		// What the Context named is gone with it: nothing of it stays lit (loop 008, C3, D).
		this.hover.clear();
		this.endPulse();
	}

	/**
	 * A choice made in the Context or through its history replaces what the Context shows: the
	 * reference the pointer rested on is gone, so the lens it held goes too (C3, D). A choice on
	 * the ribbon or in the rail leaves the hover to the pointer, which is still on the same thing.
	 */
	private settled(source: SelectSource): void {
		const navigated = source === 'context' || source === 'history';
		if (navigated) this.hover.clear();
		// «Куда смотреть»: the record, the Scope or the link chosen pulses once; a period has its
		// column; a choice on the ribbon or in the rail is already where the eye is. Whatever was
		// pulsing before is no longer what is shown.
		const current = this.selection.current;
		const target =
			navigated && current && current.kind !== 'period' && current.kind !== 'period-record'
				? current
				: null;
		this.endPulse();
		if (!target) return;
		this.pulse = { key: selectionKey(target), at: Date.now(), target };
		this.pulseTimer = setTimeout(() => {
			this.pulse = null;
		}, PULSE_MS);
	}

	private endPulse(): void {
		clearTimeout(this.pulseTimer);
		this.pulse = null;
	}

	/** Ends the open Trace form; callers pass the exit guard first. */
	closeForms(): void {
		this.capture = false;
		this.forms.editingId = null;
		this.forms.newScope = null;
		this.forms.captureReturn = null;
	}

	/** DP7: a choice made on the ribbon, by pointer or through its DOM twin, leaves the window alone. */
	selectTrace(traceId: string, source: SelectSource): void {
		this.leave(() => {
			this.selection.select({ kind: 'trace', traceId }, source);
			if (source !== 'canvas' && source !== 'twin') this.revealSelected();
			this.settled(source);
		});
	}

	selectScope(scopeId: string, source: SelectSource = 'rail'): void {
		this.leave(() => {
			this.selection.select({ kind: 'scope', scopeId }, source);
			this.revealSelected();
			this.settled(source);
		});
	}

	/**
	 * A merged row chosen by its name in the rail (C5): its Context, its records in focus, the
	 * window fitted to them. `members` are the lane's members as they stand, kept with the entry.
	 */
	selectRow(rowId: string, members: readonly string[], source: SelectSource = 'rail'): void {
		this.leave(() => {
			this.selection.select({ kind: 'row', rowId, members }, source);
			this.revealSelected();
			this.settled(source);
		});
	}

	selectIntersection(intersectionId: string, source: SelectSource = 'context'): void {
		this.leave(() => {
			this.selection.select({ kind: 'intersection', intersectionId }, source);
			this.settled(source);
		});
	}

	selectEntity(entity: ExplorerEntity): void {
		if (entity.role === 'trace') this.selectTrace(entity.record.id, 'context');
		else if (entity.role === 'scope') this.selectScope(entity.record.id, 'context');
		else if (entity.role === 'intersection') this.selectIntersection(entity.record.id);
		else if (entity.role === 'period') {
			this.leave(() => {
				this.selection.select({ kind: 'period-record', periodId: entity.record.id }, 'context');
				this.revealSelected();
				this.settled('context');
			});
		}
	}

	selectPeriod(period: PeriodRef, source: SelectSource = 'axis'): void {
		this.leave(() => {
			this.selection.select({ kind: 'period', period }, source);
			this.revealSelected();
			this.settled(source);
		});
	}

	back(): void {
		this.leave(() => {
			this.selection.back();
			this.revealSelected();
			this.settled('history');
		});
	}

	forward(): void {
		this.leave(() => {
			this.selection.forward();
			this.revealSelected();
			this.settled('history');
		});
	}

	/** Покой: the selection steps aside but stays in history; the slot list belongs to it and closes. */
	rest(): void {
		this.leave(() => {
			this.selection.rest();
			this.endPulse();
		});
	}

	/** Entity navigation fits its full time; calendar-axis selection preserves the working scale. */
	revealSelected(): void {
		const range = this.selectedRange;
		if (!range) return;
		if (this.selection.period) this.viewport.reveal(range.start, range.end);
		else this.viewport.fit(range.start, range.end);
	}

	/** Counts «К выбранному» presses: the surface centres the selected row on each one. */
	revealRequest = $state(0);

	/** «К выбранному» frames the full selected object, including one already in view, and asks the surface to centre its row. */
	goToSelected(): void {
		const range = this.selectedRange;
		if (range) this.viewport.fit(range.start, range.end);
		this.revealRequest += 1;
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
			// A form started from a Kind's page in the catalog remembers it for its cancel.
			this.forms.captureReturn = this.forms.open ? (this.forms.kindId ?? null) : null;
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

	/** The form ends with its record committed, or is closed from outside: nothing returns. */
	closeCapture(): void {
		this.exitGuard.exit(() => {
			this.capture = false;
			this.forms.open = false;
			this.forms.captureReturn = null;
		});
	}

	/** «Отмена» on «Записать»: back to the Kind it was opened from, if it was; else to nothing. */
	cancelCapture(): void {
		this.exitGuard.exit(() => {
			this.capture = false;
			const back = this.forms.captureReturn;
			this.forms.captureReturn = null;
			if (back) this.forms.showCatalog(back);
			else this.forms.open = false;
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
