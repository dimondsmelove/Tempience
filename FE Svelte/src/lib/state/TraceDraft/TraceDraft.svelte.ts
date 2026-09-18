import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { MessageKey } from '$lib/state/Locale/types';
import type { SupplementState } from '$lib/state/triplit/Traces/supplement';
import { RepositoryError } from '$lib/state/triplit/Repository/errors';
import type {
	JsonObject,
	Scope,
	Trace,
	TraceKind,
	TraceKindV,
	TraceRelation
} from '$lib/state/triplit/types';
import { currentValues, draftIssues, sameValues } from './compare';
import { jsonData } from './json';
import { loadEntry, type CatalogRows } from './load';
import { ResultsState } from './results.svelte';
import { writeRecord } from './save';
import { EMPTY_SCOPES, addScope, kindsInScopes, removeScope, selectedScopes } from './scopes';
import { resultRole, type TargetContext } from './targets';
import {
	blockedRelationOf,
	chooseKind,
	chooseVersion,
	hydrate,
	noteKind,
	switchRelation
} from './transitions';
import type {
	DraftCommit,
	DraftEntry,
	DraftFailure,
	DraftField,
	DraftIssue,
	DraftPhase,
	DraftValues,
	EvidenceRole,
	NestedEditor,
	OpenSaved,
	ScopeIntent,
	TimeDraft,
	TraceDraftOptions
} from './types';

export type { TraceDraftOptions, TraceDraftRepository } from './types';

const failureOf = (cause: unknown): DraftFailure => ({
	code: cause instanceof RepositoryError ? cause.code : null,
	message: cause instanceof Error ? cause.message : String(cause),
	cause: cause ?? new Error()
});

/**
 * The one open form of a Trace (TRACE_FORMS «общая модель формы»): its fields, the pinned
 * Kind version with the typed values SJSF edits in place, Scope intent, touched state and
 * issues, the semantic dirty comparison against the baseline and the save phase with the
 * committed id. A new opening is a new instance; closing it is the end of its input.
 */
export class TraceDraftState {
	readonly entry: DraftEntry;
	private readonly options: TraceDraftOptions;
	phase = $state<DraftPhase>('loading');
	title = $state('');
	description = $state('');
	relation = $state<TraceRelation | null>('actual');
	time = $state<TimeDraft>({ mode: 'keep' });
	timeEditing = $state(false);
	/** A Scope or Kind being created inside this form; the form's own input stays as it is. */
	nested = $state<NestedEditor | null>(null);
	/** How the open nested editor answers whether it holds input a save has not taken yet. */
	nestedInput = $state.raw<(() => boolean) | null>(null);
	/** The Kind created inside this form, offered for an explicit choice, never chosen by itself. */
	createdKind = $state.raw<TraceKind | null>(null);
	kindId = $state('');
	versionId = $state('');
	/** Typed values, edited in place by the mounted SJSF form through its value binding. */
	data = $state<JsonObject>({});
	/** Form controls whose text the browser cannot parse yet (native `badInput`), as reported. */
	nativeInvalid = $state(0);
	scopes = $state<ScopeIntent>(EMPTY_SCOPES);
	readonly touched = new SvelteSet<DraftField>();
	kinds = $state.raw<TraceKind[]>([]);
	versions = $state.raw<TraceKindV[]>([]);
	scopeList = $state.raw<Scope[]>([]);
	saved = $state.raw<Trace | null>(null);
	baseline = $state.raw<DraftValues | null>(null);
	evidenceRoles = $state.raw<EvidenceRole[]>([]);
	/** What the saved record is as a supplement (P4); null when it is not a marker. */
	supplement = $state.raw<SupplementState | null>(null);
	/** A form that cannot edit faithfully says so; nothing is rewritten to fit. */
	diagnostic = $state<MessageKey | null>(null);
	failure = $state.raw<DraftFailure | null>(null);
	commit = $state.raw<DraftCommit | null>(null);
	/** The save in flight (write and opening), what an exit waits for; never rejects. */
	pending: Promise<void> | null = null;
	/** Direct Scope memberships of every Kind: what choosing a Kind brings in. */
	kindScopes = new SvelteMap<string, string[]>();
	/** «Результат для»: the chosen records with the user's own statements, and the picker's rows. */
	readonly results = new ResultsState();
	private opener: OpenSaved | null = null;
	private readonly stops: (() => void)[] = [];
	private readonly enders: (() => void)[] = [];

	readonly typed = $derived(this.kindId !== '');
	readonly kind = $derived(this.kinds.find((entry) => entry.id === this.kindId) ?? null);
	readonly version = $derived(this.versions.find((entry) => entry.id === this.versionId) ?? null);
	readonly kindVersions = $derived(this.versions.filter((entry) => entry.kindId === this.kindId));
	readonly selectedScopeIds = $derived(selectedScopes(this.scopes));
	readonly nestedDirty = $derived(this.nestedInput?.() ?? false);
	/** Kinds directly bound to a selected Scope: the scoped picks; the whole catalog stays offered. */
	readonly scopedKinds = $derived(
		kindsInScopes(this.kinds, this.kindScopes, this.selectedScopeIds)
	);
	/** The final values the dirty comparison, the issues and the save read. */
	readonly values: DraftValues = $derived.by(() => currentValues(this));
	/** What the chosen results are checked against: a fact names intentions, an intention facts. */
	readonly targetContext: TargetContext = $derived.by(() => ({
		rows: this.results.rows,
		role: resultRole(this.values.relation),
		dated: this.values.placement.aboutTime?.basis === 'absolute',
		roles: this.evidenceRoles
	}));
	readonly open = $derived(this.phase === 'editing' || this.phase === 'saving');
	/**
	 * Whether the editable input differs from what it started with, or holds text the browser
	 * has not parsed yet. A form that is saving, committed or closed is never dirty: no exit
	 * guard blocks opening the saved record; a pending save is waited for instead.
	 */
	readonly dirty = $derived(
		this.phase === 'editing' &&
			this.baseline !== null &&
			(this.nativeInvalid > 0 || this.nestedDirty || !sameValues(this.values, this.baseline))
	);
	readonly issues: DraftIssue[] = $derived.by(() =>
		this.phase === 'loading'
			? []
			: draftIssues(this.values, {
					typed: this.typed,
					version: this.version,
					baseline: this.baseline,
					nativeInvalid: this.nativeInvalid,
					now: this.options.now?.().getTime(),
					targets: this.targetContext
				})
	);
	readonly valid = $derived(this.issues.length === 0 && this.diagnostic === null);
	readonly canSave = $derived.by(
		() =>
			this.phase === 'editing' &&
			!this.timeEditing &&
			this.nested === null &&
			this.valid &&
			(this.entry.mode === 'create' || this.dirty)
	);
	/** The relation an active evidence link forbids, with that link, if any. */
	readonly blockedRelation = $derived(blockedRelationOf(this.evidenceRoles));

	constructor(entry: DraftEntry, options: TraceDraftOptions) {
		this.entry = entry;
		this.options = options;
	}

	/** An issue shows only after its field was left once, and disappears as soon as it is fixed. */
	issueFor(field: DraftField): DraftIssue | null {
		return this.touched.has(field)
			? (this.issues.find((issue) => issue.field === field) ?? null)
			: null;
	}

	touch(field: DraftField): void {
		this.touched.add(field);
	}

	/** The mounted form reports how many of its controls hold unparsable native text. */
	reportNative(count: number): void {
		this.nativeInvalid = count;
	}

	/**
	 * Loads the catalogs and, for an edit, the record itself; the loaded state is the baseline.
	 * A form that could not load shows why and can only be closed; it saves nothing. A form
	 * closed while loading stays closed: what arrives later is dropped and disposed.
	 */
	async load(): Promise<void> {
		try {
			await this.loadEntry();
		} catch (cause) {
			this.dispose();
			if (this.phase === 'closed') return;
			this.failure = failureOf(cause);
			this.diagnostic = 'draft.loadFailed';
		}
		if (this.phase === 'closed') {
			this.dispose();
			return;
		}
		this.phase = 'editing';
	}

	private async loadEntry(): Promise<void> {
		const loaded = await loadEntry(
			this.entry,
			this.options.repository,
			(rows) => this.feed(rows),
			this.stops
		);
		if (this.phase === 'closed') return;
		hydrate(this, loaded, this.options.now?.());
		this.baseline = this.freeze();
	}

	/**
	 * The current values, detached from the form's state. The typed data goes through the
	 * JSON reading: it keeps every own key of the document, which a key-by-key copy would
	 * not (`__proto__` is a legal JSON name); an unreadable value stays as the form holds it.
	 */
	private freeze(): DraftValues {
		const frozen = $state.snapshot(this.values) as DraftValues;
		const json = this.typed ? jsonData(this.data) : null;
		return json?.ok ? { ...frozen, data: json.value } : frozen;
	}

	/** Catalog rows, first and later ones; a closed form takes none. */
	private feed(rows: CatalogRows): void {
		if (this.phase === 'closed') return;
		this.kinds = rows.kinds ?? this.kinds;
		this.versions = rows.versions ?? this.versions;
		this.scopeList = rows.scopes ?? this.scopeList;
		// The rows that name typed records read the same catalogs this form offers.
		this.results.kinds = this.kinds;
		this.results.versions = this.versions;
	}

	/** Stops every subscription started so far, each exactly once. */
	dispose(): void {
		for (const stop of this.stops.splice(0)) stop();
	}

	/** Runs once when this input ends, whichever exit or opening ended it. */
	onEnd(end: () => void): void {
		this.enders.push(end);
	}

	/** The end of this input; nothing of it is kept, and whoever showed it is told once. */
	discard(): void {
		if (this.phase === 'closed') return;
		this.dispose();
		this.phase = 'closed';
		for (const end of this.enders.splice(0)) end();
	}

	/** The accepted relation and Kind transitions of a new input (see `transitions.ts`). */
	setRelation(next: TraceRelation): void {
		switchRelation(this, next, this.options.now?.());
	}

	chooseKind(kindId: string, versionId?: string): void {
		chooseKind(this, kindId, versionId);
	}

	chooseVersion(versionId: string): void {
		chooseVersion(this, versionId, this.options.defaults);
	}

	/** A Kind saved inside this form: selectable at once, with the memberships it was given. */
	noteKind(kind: TraceKind, version: TraceKindV, scopeIds: readonly string[]): void {
		noteKind(this, kind, version, scopeIds);
	}

	addScope(id: string): void {
		if (id) this.scopes = addScope(this.scopes, id);
	}

	removeScope(id: string): void {
		this.scopes = removeScope(this.scopes, id);
	}

	/**
	 * One save of the whole current input through the atomic record command. Success latches
	 * the committed id and operation before anything opens; a write failure keeps the input
	 * editable for an explicit retry; an opening failure never writes again. The returned
	 * promise is the pending save an exit waits for.
	 */
	save(open: OpenSaved): Promise<void> {
		if (!this.canSave) return Promise.resolve();
		return this.track(this.commitThenOpen(open));
	}

	/** Opening the committed record again, with the same id; the record is never written again. */
	retryOpen(): Promise<void> {
		if (this.phase !== 'openFailed') return Promise.resolve();
		return this.track(this.openSaved());
	}

	/** A nested Scope/Kind step in flight is this form's pending work: exits wait for it too. */
	hold(run: Promise<void>): Promise<void> {
		return this.track(run);
	}

	private track(run: Promise<void>): Promise<void> {
		const settled = run.finally(() => {
			if (this.pending === settled) this.pending = null;
		});
		this.pending = settled;
		return settled;
	}

	private async commitThenOpen(open: OpenSaved): Promise<void> {
		this.phase = 'saving';
		this.failure = null;
		const values = this.freeze();
		try {
			const result = await writeRecord(this.options, this.entry, values, this.baseline);
			this.commit = { id: result.trace.id, operation: result.operation };
			this.phase = 'saved';
		} catch (cause) {
			this.failure = failureOf(cause);
			this.phase = 'editing';
			return;
		}
		this.opener = open;
		await this.openSaved();
	}

	private async openSaved(): Promise<void> {
		if (!this.commit || !this.opener) return;
		this.phase = 'opening';
		this.failure = null;
		try {
			await this.opener(this.commit.id);
			this.discard();
		} catch (cause) {
			this.failure = failureOf(cause);
			this.phase = 'openFailed';
		}
	}
}
