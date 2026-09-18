import { locale } from '$lib/state/Locale/Locale.svelte';
import { errorText } from '$lib/state/Locale/errors';
import { traceSummary, type KindCatalog, type TraceSummary } from '$lib/model/TraceForm/summary';
import { versionSummaries, type VersionSummary } from '$lib/model/TraceForm/summary-fields';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import type { Trace } from '$lib/state/triplit/types';

export type DeletedRecordsRepository = Pick<
	TempienceRepository,
	'listTraceHeads' | 'subscribeTraceHeads' | 'listTraceKinds' | 'listTraceKindVersions'
>;

/** One record that was deleted, as the list of them shows it. */
export type DeletedRecord = Readonly<{ trace: Trace; summary: TraceSummary }>;

/**
 * The records that were deleted: readable, restorable, and deliberately outside the active
 * timeline, which shows what is. It reads the deleted records only, thin — their summary
 * leaves and nothing else of their data — and follows that same query, so a deletion or a
 * restore anywhere reaches this list without anyone pressing anything. Every delivery, the
 * first included, is the list's new content; nothing is read again for it, and a delivery is
 * never lost to a read.
 */
export class DeletedRecordsReader {
	private readonly repository: DeletedRecordsRepository;
	loading = $state(false);
	/** The cause of the last refused read, or null; `error` is its words in the language of the moment. */
	failure = $state.raw<unknown>(null);
	get error(): string {
		return this.failure === null ? '' : errorText(this.failure);
	}
	records = $state.raw<readonly DeletedRecord[]>([]);
	private catalog: KindCatalog | null = null;
	/** The leaves the thin read carries, per version; known once the catalog has been read. */
	private summaries: readonly VersionSummary[] | null = null;
	/** What the subscription delivered last, and how many times, for a read to compare with. */
	private delivered: readonly Trace[] | null = null;
	private deliveries = 0;
	private request = 0;
	private stop: (() => void) | null = null;
	/** Whether the list is being followed; the query opens once the leaves are known. */
	private following = false;
	private watching = 0;

	constructor(repository: DeletedRecordsRepository) {
		this.repository = repository;
	}

	async load(): Promise<void> {
		const request = ++this.request;
		const seen = this.deliveries;
		this.loading = true;
		this.failure = null;
		try {
			const [kinds, versions] = await Promise.all([
				this.repository.listTraceKinds(),
				this.repository.listTraceKindVersions()
			]);
			if (request !== this.request) return;
			this.catalog = { kinds, versions };
			this.summaries = versionSummaries(versions);
			// Following was asked for before the leaves were known: the query opens now.
			if (this.following && this.stop === null) this.follow();
			const traces = await this.repository.listTraceHeads({
				deleted: 'deleted',
				summaries: this.summaries
			});
			if (request !== this.request) return;
			// Rows the replica delivered while this read was in flight are newer than the read.
			this.show(this.deliveries !== seen && this.delivered ? this.delivered : traces);
		} catch (cause) {
			if (request !== this.request) return;
			this.failure = cause ?? new Error();
		} finally {
			if (request === this.request) this.loading = false;
		}
	}

	/** The rows shown last, for a redisplay in another language. */
	private shown: readonly Trace[] = [];

	/** The same rows in the language of the moment; nothing is read for it. */
	redisplay(): void {
		this.show(this.shown);
	}

	private show(traces: readonly Trace[]): void {
		const catalog = this.catalog;
		if (!catalog) return;
		this.shown = traces;
		this.records = traces
			.filter((trace) => trace.isDeleted)
			.map((trace) => ({ trace, summary: traceSummary(trace, catalog, locale.current) }))
			.toSorted((left, right) => right.trace.updatedAt.localeCompare(left.trace.updatedAt));
	}

	/**
	 * Follows the deleted records. The query needs the summary leaves of the Kind versions,
	 * which the read brings; asked for earlier, it opens as soon as they are known, and a
	 * delivery that arrives before the first read has landed is kept for that read.
	 */
	watch(): () => void {
		this.stopWatching();
		this.following = true;
		if (this.summaries !== null) this.follow();
		return () => this.stopWatching();
	}

	private follow(): void {
		const generation = ++this.watching;
		const mine = (): boolean => generation === this.watching;
		this.stop = this.repository.subscribeTraceHeads(
			{ deleted: 'deleted', summaries: this.summaries ?? [] },
			(traces) => {
				if (!mine()) return;
				this.delivered = traces;
				this.deliveries += 1;
				this.show(traces);
			},
			(cause) => {
				if (mine()) this.failure = cause ?? new Error();
			}
		);
	}

	/** Ends the subscription; a delivery of it that is still on its way answers for nothing. */
	stopWatching(): void {
		this.following = false;
		this.watching += 1;
		this.stop?.();
		this.stop = null;
	}
}
