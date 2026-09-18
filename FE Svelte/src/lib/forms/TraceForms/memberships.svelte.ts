import { errorText } from '$lib/state/Locale/errors';
import type { TempienceRepository } from '$lib/state/triplit/repository';

export type KindMemberships = Readonly<{ kindId: string; scopeIds: readonly string[] }>;

/**
 * The selected Kind's direct memberships for the Builder, read when the Kind is chosen and
 * after each save. Only the latest choice's read may land: a slow read of an earlier Kind is
 * dropped, a refused read is shown with a retry, and the Builder mounts with the memberships
 * of the Kind it edits or not at all.
 */
export class KindMembershipsLoader {
	value = $state.raw<KindMemberships | null>(null);
	/** The cause of a refused read, or null; `error` is its words in the language of the moment. */
	failure = $state.raw<unknown>(null);
	get error(): string | null {
		return this.failure === null ? null : errorText(this.failure);
	}
	private request = 0;
	private readonly repository: Pick<TempienceRepository, 'listKindMemberships'>;

	constructor(repository: Pick<TempienceRepository, 'listKindMemberships'>) {
		this.repository = repository;
	}

	/** The memberships of this Kind if they are known, else null (loading or refused). */
	for(kindId: string): readonly string[] | null {
		return this.value?.kindId === kindId ? this.value.scopeIds : null;
	}

	async load(kindId: string | undefined): Promise<void> {
		const request = ++this.request;
		this.failure = null;
		if (this.value?.kindId !== kindId) this.value = null;
		if (!kindId) return;
		try {
			const links = await this.repository.listKindMemberships({ kindId, deleted: 'active' });
			if (request !== this.request) return;
			this.value = { kindId, scopeIds: links.map((link) => link.toId) };
		} catch (cause) {
			if (request !== this.request) return;
			this.failure = cause ?? new Error();
		}
	}
}
