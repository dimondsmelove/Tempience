import { errorText } from '$lib/state/Locale/errors';
import type { TempienceRepository } from '$lib/state/triplit/repository';
import type { Intersection, Scope, TraceKind } from '$lib/state/triplit/types';

export type DeletedScopesRepository = Pick<
	TempienceRepository,
	| 'listScopes'
	| 'listTraceKinds'
	| 'subscribeDeletedScopes'
	| 'listKindMemberships'
	| 'subscribeKindMemberships'
	| 'listMemberIds'
	| 'subscribeMemberIds'
>;

/** One Scope that was deleted, with what bringing it back would bring back with it. */
export type DeletedScope = Readonly<{
	scope: Scope;
	/** The Kinds whose membership this very deletion hid; a return gives exactly these back. */
	returning: readonly Readonly<{ id: string; name: string }>[];
	/** Records that belong to the Scope and will be in it again: they were never touched. */
	records: number;
}>;

type Fed = 'scopes' | 'links' | 'members';

type Rows = {
	scopes: readonly Scope[];
	kinds: readonly TraceKind[];
	/** The Kinds' memberships leading to the deleted Scopes, withdrawn ones included. */
	links: readonly Intersection[];
	/** How many active records belong to each deleted Scope, once its query has answered. */
	members: Readonly<Record<string, number>>;
};

const key = (ids: readonly string[]): string => ids.toSorted().join('\n');

/**
 * The Scopes that were deleted: readable, restorable, and off the timeline. Deleting a Scope
 * hides the Kind memberships it had, each stamped with that deletion; the records in it are
 * left exactly as they are. Bringing it back returns only the memberships still carrying that
 * stamp — one withdrawn explicitly in the meantime stays withdrawn — so this list says, per
 * Scope, what a return would bring back, before anyone presses anything. It reads what is
 * bound to the deleted Scopes and nothing else: their Kind memberships, and the ids of their
 * active records; and it follows the deleted Scopes and, for exactly those, the same two
 * queries, renewed when the deleted Scopes change. Every delivery is its new content, and a
 * delivery is never lost to a read: one that arrives before the first read has landed is
 * what that read shows, and one that arrives while a later read is in flight stands over it.
 */
export class DeletedScopesReader {
	private readonly repository: DeletedScopesRepository;
	loading = $state(false);
	/** The cause of the last refused read, or null; `error` is its words in the language of the moment. */
	failure = $state.raw<unknown>(null);
	get error(): string {
		return this.failure === null ? '' : errorText(this.failure);
	}
	records = $state.raw<readonly DeletedScope[]>([]);
	private rows: Rows | null = null;
	/** What the subscriptions delivered, and how many times, per query. */
	private delivered: {
		scopes?: readonly Scope[];
		links?: readonly Intersection[];
		members: Record<string, number>;
	} = { members: {} };
	private deliveries: Record<Fed, number> = { scopes: 0, links: 0, members: 0 };
	private request = 0;
	private open = false;
	private stopScopes: (() => void) | null = null;
	private stopsBound: (() => void)[] = [];
	/** The deleted Scopes the bounded queries are open for. */
	private boundTo: string | null = null;
	private watching = 0;
	private bounding = 0;

	constructor(repository: DeletedScopesRepository) {
		this.repository = repository;
	}

	async load(): Promise<void> {
		const request = ++this.request;
		const seen = { ...this.deliveries };
		this.loading = true;
		this.failure = null;
		try {
			const [all, kinds] = await Promise.all([
				this.repository.listScopes(true),
				this.repository.listTraceKinds()
			]);
			if (request !== this.request) return;
			// The deleted Scopes the replica delivered while the read was in flight are newer than it.
			const scopes =
				this.deliveries.scopes !== seen.scopes && this.delivered.scopes
					? this.delivered.scopes
					: all.filter((scope) => scope.isDeleted);
			const ids = scopes.map((scope) => scope.id);
			// Following was asked for before the deleted Scopes were known: their queries open now.
			if (this.open) this.follow(ids);
			const [links, counts] = await Promise.all([
				this.repository.listKindMemberships({ scopeIds: ids, deleted: 'all' }),
				Promise.all(
					ids.map(async (id) => [id, (await this.repository.listMemberIds(id)).length] as const)
				)
			]);
			if (request !== this.request) return;
			// What the replica delivered while either phase was in flight is newer than the read:
			// the deleted Scopes of the delivery, and of the counts those of the current queries
			// — read for the Scopes read, delivered for the Scopes delivered — never one of a
			// Scope that is not deleted any more.
			const current =
				this.deliveries.scopes !== seen.scopes && this.delivered.scopes
					? this.delivered.scopes
					: scopes;
			const members: Record<string, number> = {};
			for (const [id, count] of counts) members[id] = count;
			if (this.deliveries.members !== seen.members) {
				for (const [id, count] of Object.entries(this.delivered.members)) members[id] = count;
			}
			for (const id of Object.keys(members)) {
				if (!current.some((scope) => scope.id === id)) delete members[id];
			}
			this.rows = {
				scopes: current,
				kinds,
				links:
					this.deliveries.links !== seen.links && this.delivered.links
						? this.delivered.links
						: links,
				members
			};
			this.show();
		} catch (cause) {
			if (request !== this.request) return;
			this.failure = cause ?? new Error();
		} finally {
			if (request === this.request) this.loading = false;
		}
	}

	private show(): void {
		const rows = this.rows;
		if (!rows) return;
		// Plain lookups of one computation, never kept: the answer is what is reactive.
		const nameOf = (id: string): string => rows.kinds.find((kind) => kind.id === id)?.name ?? id;
		this.records = rows.scopes
			// A Scope whose records have not been counted yet is shown once they have been.
			.filter((scope) => scope.id in rows.members)
			.map((scope) => ({
				scope,
				returning: rows.links
					.filter(
						(link) =>
							link.toId === scope.id &&
							link.isDeleted &&
							scope.deletionOperationId !== null &&
							link.scopeDeletionOperationId === scope.deletionOperationId
					)
					.map((link) => ({ id: link.fromId, name: nameOf(link.fromId) })),
				records: rows.members[scope.id] ?? 0
			}));
	}

	/**
	 * Follows the deleted Scopes and, for exactly those, what is bound to them. The bounded
	 * queries need the deleted Scopes, which the read or the first delivery brings; asked for
	 * earlier, they open as soon as those are known. A delivery of an ended watch is nothing.
	 */
	watch(): () => void {
		this.stopWatching();
		this.open = true;
		const generation = ++this.watching;
		const mine = (): boolean => generation === this.watching;
		this.stopScopes = this.repository.subscribeDeletedScopes(
			(scopes) => {
				if (!mine()) return;
				this.delivered.scopes = scopes;
				this.deliveries.scopes += 1;
				this.follow(scopes.map((scope) => scope.id));
				// Before the first read has landed there is nothing to show it with; that read
				// takes the delivered rows when it lands.
				if (!this.rows) return;
				this.rows = { ...this.rows, scopes };
				this.show();
			},
			(cause) => {
				if (mine()) this.failure = cause ?? new Error();
			}
		);
		if (this.rows) this.follow(this.rows.scopes.map((scope) => scope.id));
		return () => this.stopWatching();
	}

	/** Opens the bounded queries for these deleted Scopes, ending those of any other set. */
	private follow(ids: readonly string[]): void {
		if (!this.open || this.boundTo === key(ids)) return;
		this.unfollow();
		this.boundTo = key(ids);
		const generation = ++this.bounding;
		const mine = (): boolean => generation === this.bounding;
		const fail = (cause: unknown): void => {
			if (mine()) this.failure = cause ?? new Error();
		};
		this.delivered.members = {};
		this.stopsBound = [
			this.repository.subscribeKindMemberships(
				{ scopeIds: ids, deleted: 'all' },
				(links) => {
					if (!mine()) return;
					this.delivered.links = links;
					this.deliveries.links += 1;
					if (!this.rows) return;
					this.rows = { ...this.rows, links };
					this.show();
				},
				fail
			),
			...ids.map((id) =>
				this.repository.subscribeMemberIds(
					id,
					(memberIds) => {
						if (!mine()) return;
						this.delivered.members[id] = memberIds.length;
						this.deliveries.members += 1;
						if (!this.rows) return;
						this.rows = {
							...this.rows,
							members: { ...this.rows.members, [id]: memberIds.length }
						};
						this.show();
					},
					fail
				)
			)
		];
	}

	private unfollow(): void {
		this.bounding += 1;
		this.boundTo = null;
		for (const stop of this.stopsBound.splice(0)) stop();
	}

	stopWatching(): void {
		this.open = false;
		this.watching += 1;
		this.stopScopes?.();
		this.stopScopes = null;
		this.unfollow();
	}
}
