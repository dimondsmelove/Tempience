import { errorText } from '$lib/state/Locale/errors';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import type { TraceKind } from '$lib/state/triplit/types';

export type ScopeKindsRepository = Pick<
	TempienceRepository,
	'listTraceKinds' | 'listKindMemberships'
>;

/**
 * The Kinds directly bound to one Scope (core/trace-scope): no subtree, no legacy suggestions.
 * The Scope panel shows them in a part of their own and counts them when it offers to delete
 * the Scope, so one read serves both; only the latest request lands.
 */
export class ScopeKindsReader {
	private readonly repository: ScopeKindsRepository;
	kinds = $state.raw<readonly TraceKind[]>([]);
	loading = $state(true);
	/** The cause of the last refused read, or null; `error` is its words in the language of the moment. */
	failure = $state.raw<unknown>(null);
	get error(): string {
		return this.failure === null ? '' : errorText(this.failure);
	}
	private request = 0;

	constructor(repository: ScopeKindsRepository) {
		this.repository = repository;
	}

	async load(scopeId: string): Promise<void> {
		const request = ++this.request;
		this.loading = true;
		this.failure = null;
		try {
			const [rows, links] = await Promise.all([
				this.repository.listTraceKinds(),
				this.repository.listKindMemberships({ scopeIds: [scopeId], deleted: 'active' })
			]);
			if (request !== this.request) return;
			const bound = links.map((link) => link.fromId);
			this.kinds = rows.filter((kind) => bound.includes(kind.id));
		} catch (cause) {
			if (request !== this.request) return;
			this.failure = cause ?? new Error();
		} finally {
			if (request === this.request) this.loading = false;
		}
	}
}
