import { errorText } from '$lib/state/Locale/errors';
import type { KindCatalog } from '$lib/model/TraceForm/summary';
import { versionSummaries, type VersionSummary } from '$lib/model/TraceForm/summary-fields';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
import { byNewestAssessed } from '$lib/state/triplit/IntentionAssessments/read';
import { byNewestUpdated } from '$lib/state/triplit/Intersections/read';
import { byNewestCaptured } from '$lib/state/triplit/Traces/read';
import type { Intersection, Log, Scope, Trace } from '$lib/state/triplit/types';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import { namedRecordIds } from '$lib/model/History/history';
import { linkedRecords, neighbourIds } from './links';
import type { LinkedRecords } from './types';

export type RecordsRepository = Pick<
	TempienceRepository,
	| 'readTraceRow'
	| 'subscribeTraceRow'
	| 'listIntersectionsTouching'
	| 'subscribeIntersectionsTouching'
	| 'listIntentionAssessmentsFor'
	| 'subscribeIntentionAssessmentsFor'
	| 'listTraceHeads'
	| 'subscribeTraceHeads'
	| 'listScopes'
	| 'listTraceKinds'
	| 'listTraceKindVersions'
	| 'subscribeLogsFor'
>;

/** The collections the answer follows, each by its own bounded query. */
type Fed = 'record' | 'links' | 'assessments' | 'others';

type Rows = {
	/** The selected record itself, whole, or null when this replica does not hold it. */
	record: Trace | null;
	/** Every link touching the record, withdrawn ones included. */
	links: readonly Intersection[];
	/** Every statement addressed to the record, now or originally, or made through it. */
	assessments: readonly IntentionAssessment[];
	/** The records the answer needs beside its own: read thin, by id. */
	others: readonly Trace[];
	scopes: readonly Scope[];
	catalog: KindCatalog;
	/** The data leaves the thin reads carry: the summary leaves of the Kind versions. */
	summaries: readonly VersionSummary[];
};

/**
 * The focused read of one selected record: its links together with the records at their other
 * ends, including the ones the timeline does not carry because they are deleted or absent from
 * this replica, its own journal, and what it is as an intention.
 *
 * Every read is bounded by the record: its own row whole; the links touching it; the statements
 * addressed to it; then, by id, the records those name — thin, their summary leaves only. The
 * Scopes and the Kind catalogs are read once per read, as they are small and change rarely.
 *
 * The answer follows the replica through live queries of the same bounds. `load` reads once;
 * `watch` follows the record, its links and its statements, and every delivery — the first
 * included — replaces the rows of its collection and recomputes the answer; the neighbours
 * are followed by a query over their ids that is renewed when the ids change, and the journal
 * by a query over the record's own ids. Nothing is read again on a delivery, and a read that
 * lands after a delivery keeps the delivered rows. Every callback belongs to the lifetime that
 * opened it: a stopped or replaced subscription answers for nothing.
 */
export class RecordsReader {
	private readonly repository: RecordsRepository;
	traceId = $state<string | null>(null);
	loading = $state(false);
	/** The cause of the last refused read, or null; `error` is its words in the language of the moment. */
	failure = $state.raw<unknown>(null);
	get error(): string {
		return this.failure === null ? '' : errorText(this.failure);
	}
	result = $state.raw<LinkedRecords | null>(null);
	/** The journal of this record and of everything it names, newest first. */
	logs = $state.raw<readonly Log[]>([]);
	/**
	 * The records the journal's values name and the answer does not hold — an intention a
	 * statement was moved from or to — read thin, by id, when the journal delivers them.
	 */
	named = $state.raw<readonly Trace[]>([]);
	private namedKey = '';
	/** Which named read is current; an earlier one landing later answers for nothing. */
	private namedRequest = 0;
	/** The Kinds and versions the answer was read with; a caller shows the record through them. */
	catalog = $state.raw<KindCatalog | null>(null);
	private rows: Rows | null = null;
	private delivered: Partial<Pick<Rows, Fed>> = {};
	private deliveries: Record<Fed, number> = { record: 0, links: 0, assessments: 0, others: 0 };
	private request = 0;
	private stops: (() => void)[] = [];
	/** Which `watch()` is current; a feed of an earlier one answers for nothing. */
	private watching = 0;
	private othersStop: (() => void) | null = null;
	private othersKey = '';
	private othersGeneration = 0;
	private journalStop: (() => void) | null = null;
	private journalKey = '';
	private journalGeneration = 0;
	/** Whether this reader may still show and follow a record; a stopped one may not. */
	private open = true;

	constructor(repository: RecordsRepository) {
		this.repository = repository;
	}

	/**
	 * The rows of `traceId`, read once; only the latest request lands, a stale answer is dropped.
	 * An explicit read re-opens a stopped reader — it is an explicit ask — and what it opens is
	 * ended by the next `stopWatching()`; only `watch()` starts following the record.
	 */
	async load(traceId: string): Promise<void> {
		const request = ++this.request;
		const seen = { ...this.deliveries };
		this.traceId = traceId;
		this.loading = true;
		this.failure = null;
		this.open = true;
		try {
			const [record, links, assessments, scopes, kinds, versions] = await Promise.all([
				this.repository.readTraceRow(traceId),
				this.repository.listIntersectionsTouching(traceId),
				this.repository.listIntentionAssessmentsFor(traceId),
				this.repository.listScopes(true),
				this.repository.listTraceKinds(),
				this.repository.listTraceKindVersions()
			]);
			if (request !== this.request || !this.open) return;
			const summaries = versionSummaries(versions);
			const others = await this.repository.listTraceHeads({
				ids: neighbourIds(traceId, record, links, assessments),
				deleted: 'all',
				summaries
			});
			// A superseded read, or one that lands after the reader was stopped, shows nothing and
			// opens nothing: its journal query would outlive the view that asked for the record.
			if (request !== this.request || !this.open) return;
			// A collection the replica delivered while this read was in flight is newer than it.
			const fresh = <Key extends Fed>(key: Key, read: Rows[Key]): Rows[Key] =>
				this.deliveries[key] !== seen[key] && key in this.delivered
					? (this.delivered[key] as Rows[Key])
					: read;
			this.rows = {
				record: fresh('record', record),
				links: fresh('links', links.toSorted(byNewestUpdated)),
				assessments: fresh('assessments', assessments.toSorted(byNewestAssessed)),
				others: fresh('others', others),
				scopes,
				catalog: { kinds, versions },
				summaries
			};
			this.catalog = this.rows.catalog;
			this.compute(traceId);
		} catch (cause) {
			if (request !== this.request) return;
			this.failure = cause ?? new Error();
			this.result = null;
			this.logs = [];
		} finally {
			if (request === this.request) this.loading = false;
		}
	}

	/** The answer from the rows at hand, and the queries it calls for. */
	private compute(traceId: string): void {
		const rows = this.rows;
		if (!rows) return;
		this.result = linkedRecords(traceId, {
			traces: [...(rows.record ? [rows.record] : []), ...rows.others],
			intersections: rows.links,
			assessments: rows.assessments,
			scopes: rows.scopes,
			catalog: rows.catalog
		});
		if (this.watching > 0 && this.stops.length > 0) this.watchOthers(traceId);
		this.watchJournal();
	}

	/**
	 * Follows the record, the links touching it and the statements addressed to it. Every
	 * delivery of a feed — its opening answer included — replaces that collection's rows and
	 * recomputes the answer; the neighbours' query follows from what the links and statements
	 * name, and is renewed when that changes.
	 */
	watch(): () => void {
		this.stopFeeds();
		// Following a record is asking for it again, including the read already in flight.
		this.open = true;
		const traceId = this.traceId;
		if (!traceId) return () => this.stopWatching();
		const generation = ++this.watching;
		const mine = (): boolean => generation === this.watching;
		const fail = (cause: unknown): void => {
			if (!mine()) return;
			this.failure = cause ?? new Error();
		};
		const land = <Key extends Fed>(key: Key, rows: Rows[Key]): void => {
			if (!mine()) return;
			this.delivered = { ...this.delivered, [key]: rows };
			this.deliveries[key] += 1;
			// Before the first read has landed there is nothing to recompute with; the read takes
			// the delivered rows when it lands.
			if (!this.rows || !this.traceId) return;
			this.rows = { ...this.rows, [key]: rows };
			this.compute(this.traceId);
		};
		this.stops = [
			this.repository.subscribeTraceRow(traceId, (row) => land('record', row), fail),
			this.repository.subscribeIntersectionsTouching(
				traceId,
				(rows) => land('links', rows.toSorted(byNewestUpdated)),
				fail
			),
			this.repository.subscribeIntentionAssessmentsFor(
				traceId,
				(rows) => land('assessments', rows.toSorted(byNewestAssessed)),
				fail
			)
		];
		// An answer already shown is followed again by its neighbours and its journal.
		if (this.rows && this.result?.traceId === traceId) {
			this.watchOthers(traceId);
			if (this.journalStop === null) this.watchJournal();
		}
		return () => this.stopWatching();
	}

	/** The neighbours as a live query over their ids, renewed when the ids change. */
	private watchOthers(traceId: string): void {
		const rows = this.rows;
		if (!rows) return;
		const ids = neighbourIds(traceId, rows.record, rows.links, rows.assessments);
		const key = ids.join(' ');
		if (key === this.othersKey && this.othersStop !== null) return;
		this.othersStop?.();
		this.othersKey = key;
		const generation = ++this.othersGeneration;
		const mine = (): boolean => generation === this.othersGeneration;
		this.othersStop = this.repository.subscribeTraceHeads(
			{ ids, deleted: 'all', summaries: rows.summaries },
			(others) => {
				if (!mine() || !this.rows || !this.traceId) return;
				this.delivered = { ...this.delivered, others };
				this.deliveries.others += 1;
				this.rows = { ...this.rows, others: others.toSorted(byNewestCaptured) };
				this.compute(this.traceId);
			},
			(cause) => {
				if (mine()) this.failure = cause ?? new Error();
			}
		);
	}

	/**
	 * Ends every subscription this reader started, each exactly once, and closes the reader: a
	 * feed or a query that was ended answers for nothing, and a read still in flight lands
	 * nowhere, because its queries would have no one to end them.
	 */
	stopWatching(): void {
		this.open = false;
		this.stopFeeds();
		this.stopJournal();
	}

	/** Ends the feeds of the current watch, the neighbours' query with them. */
	private stopFeeds(): void {
		this.watching += 1;
		for (const stop of this.stops.splice(0)) stop();
		this.othersGeneration += 1;
		this.othersStop?.();
		this.othersStop = null;
		this.othersKey = '';
	}

	/** Ends the journal query; its late answers belong to no one, and the next answer reopens. */
	private stopJournal(): void {
		this.journalGeneration += 1;
		this.journalStop?.();
		this.journalStop = null;
		this.journalKey = '';
		this.named = [];
		this.namedKey = '';
		this.namedRequest += 1;
	}

	/**
	 * The journal of the record and of the links and statements it names, as a live query.
	 * The query is kept while it names the same records; a replaced or stopped one is ended and
	 * can no longer answer, and a refused one is not remembered as current, so the next answer
	 * opens it again.
	 */
	private watchJournal(): void {
		const ids = this.journalIds();
		const key = ids.join(' ');
		if (key === this.journalKey && this.journalStop !== null) return;
		this.journalStop?.();
		this.journalKey = key;
		const generation = ++this.journalGeneration;
		const mine = (): boolean => generation === this.journalGeneration;
		this.journalStop = this.repository.subscribeLogsFor(
			ids,
			(rows) => {
				if (!mine()) return;
				this.logs = rows;
				void this.readNamed(rows, generation);
			},
			(cause) => {
				if (!mine()) return;
				this.failure = cause ?? new Error();
				// Nothing follows this record's journal now; the next answer opens it again.
				this.journalStop?.();
				this.journalStop = null;
				this.journalKey = '';
			}
		);
	}

	/**
	 * The names the journal needs beyond the answer, read once per set of ids: a lookup by id
	 * (`in`), never a scan. The set can return to an earlier one — a statement moved away and
	 * back changes what the answer holds — so only the latest read lands, by its number, as
	 * with every read of this reader; one that lands after the journal was replaced, after a
	 * newer read was asked for, or after the reader stopped answers for nothing.
	 */
	private async readNamed(logs: readonly Log[], generation: number): Promise<void> {
		const known = [this.rows?.record?.id, ...(this.rows?.others ?? []).map((row) => row.id)];
		const ids = namedRecordIds(logs).filter((id) => !known.includes(id));
		const key = ids.join(' ');
		if (key === this.namedKey) return;
		this.namedKey = key;
		const request = ++this.namedRequest;
		if (!ids.length) {
			this.named = [];
			return;
		}
		try {
			const heads = await this.repository.listTraceHeads({
				ids,
				deleted: 'all',
				summaries: this.rows?.summaries ?? []
			});
			if (request !== this.namedRequest || generation !== this.journalGeneration) return;
			this.named = heads;
		} catch (cause) {
			if (request !== this.namedRequest || generation !== this.journalGeneration) return;
			// The ids stay as stored, and the next delivery of the journal asks again.
			this.namedKey = '';
			this.failure = cause ?? new Error();
		}
	}

	/** What this record's history is made of: itself, its links and the statements about it. */
	private journalIds(): string[] {
		const result = this.result;
		if (!result) return [];
		const ids: string[] = [];
		const name = (id: string | null | undefined): void => {
			if (id && !ids.includes(id)) ids.push(id);
		};
		name(result.traceId);
		for (const link of result.links) name(link.linkId);
		for (const source of result.result?.sources ?? []) {
			name(source.id);
			name(source.evidenceId);
		}
		for (const link of result.withdrawnLinks) name(link.linkId);
		// Joining a Scope and leaving one are consequences of this record, not of the Scope.
		for (const membership of result.memberships) name(membership.linkId);
		for (const id of result.pastSourceIds) name(id);
		return ids.toSorted();
	}

	/** The answer said again from the rows at hand — the names in another language. */
	redisplay(): void {
		if (this.rows && this.traceId) this.compute(this.traceId);
	}

	/** Reads the same record again, after a write or a refused read. */
	reload(): Promise<void> {
		return this.traceId ? this.load(this.traceId) : Promise.resolve();
	}

	/** The rows of this record, or none while the first read is still running. */
	get links() {
		return this.result?.traceId === this.traceId ? this.result.links : [];
	}
}
