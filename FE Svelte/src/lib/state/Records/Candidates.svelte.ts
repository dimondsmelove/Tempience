import { locale } from '$lib/state/Locale/Locale.svelte';
import { errorText } from '$lib/state/Locale/errors';
import { traceSummary } from '$lib/model/TraceForm/summary';
import { versionSummaries } from '$lib/model/TraceForm/summary-fields';
import type { TempienceRepository } from '$lib/state/triplit/repository';

export type CandidatesRepository = Pick<
	TempienceRepository,
	'listTraceHeads' | 'listTraceKinds' | 'listTraceKindVersions'
>;

/** One intention a correction of an address may choose, named as its row is. */
export type IntentionCandidate = Readonly<{ id: string; title: string }>;

/**
 * The active intentions a correction of an address may choose from, read thin — their summary
 * leaves and nothing else — when the correction step opens, not when a record is opened. One
 * record is left out: the one whose address is being corrected addresses no one but others.
 */
export class IntentionCandidatesReader {
	private readonly repository: CandidatesRepository;
	loading = $state(false);
	/** The cause of the last refused read, or null; `error` is its words in the language of the moment. */
	failure = $state.raw<unknown>(null);
	get error(): string {
		return this.failure === null ? '' : errorText(this.failure);
	}
	candidates = $state.raw<readonly IntentionCandidate[]>([]);
	private request = 0;

	constructor(repository: CandidatesRepository) {
		this.repository = repository;
	}

	async load(except: string | null): Promise<void> {
		const request = ++this.request;
		this.loading = true;
		this.failure = null;
		try {
			const [kinds, versions] = await Promise.all([
				this.repository.listTraceKinds(),
				this.repository.listTraceKindVersions()
			]);
			const rows = await this.repository.listTraceHeads({
				deleted: 'active',
				relation: 'intend',
				summaries: versionSummaries(versions)
			});
			if (request !== this.request) return;
			const catalog = { kinds, versions };
			this.candidates = rows
				.filter((row) => row.id !== except)
				.map((row) => ({
					id: row.id,
					title: traceSummary(row, catalog, locale.current).title ?? row.id
				}));
		} catch (cause) {
			if (request !== this.request) return;
			this.failure = cause ?? new Error();
		} finally {
			if (request === this.request) this.loading = false;
		}
	}
}
