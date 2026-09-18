import type { TempienceTriplitClient } from '../client';
import { idsKey, noop, sortedUnique } from './helpers';
import type { ScopeHierarchyEdge, TraceDatasetRequest, Unsubscribe, UnknownRecord } from './types';

const subscribeDirectScope = (
	client: TempienceTriplitClient,
	scopeId: string,
	onScopeIds: (ids: string[]) => void,
	onError: (cause: unknown) => void
): Unsubscribe => {
	const query = client
		.query('scopes')
		.Where('id', '=', scopeId)
		.Where('isDeleted', '=', false)
		.Select(['id']);
	return client.subscribe(
		query,
		(values) => onScopeIds(values.length > 0 ? [scopeId] : []),
		onError
	);
};

const normalizeHierarchyEdges = (values: readonly unknown[]): ScopeHierarchyEdge[] =>
	values.map((value) => {
		const record = value as UnknownRecord;
		return {
			id: String(record.id),
			fromId: String(record.fromId),
			toId: String(record.toId)
		};
	});

const subscribeSubtreeScope = (
	client: TempienceTriplitClient,
	rootScopeId: string,
	onScopeIds: (ids: string[]) => void,
	onError: (cause: unknown) => void
): Unsubscribe => {
	// Keep frontier subscriptions stable per Scope. Replacing one changing `id in [...]`
	// subscription while expanding the tree produced stale snapshots in the installed Triplit.
	let disposed = false;
	let lastEmittedKey: string | null = null;
	type ScopeState = { active: boolean | undefined; unsubscribe: Unsubscribe };
	type EdgeState = { edges: ScopeHierarchyEdge[] | undefined; unsubscribe: Unsubscribe };
	const scopeStates = new Map<string, ScopeState>();
	const edgeStates = new Map<string, EdgeState>();

	const removeScopeSubscription = (scopeId: string): void => {
		const state = scopeStates.get(scopeId);
		if (!state) return;
		scopeStates.delete(scopeId);
		state.unsubscribe();
	};

	const removeEdgeSubscription = (parentScopeId: string): void => {
		const state = edgeStates.get(parentScopeId);
		if (!state) return;
		edgeStates.delete(parentScopeId);
		state.unsubscribe();
	};

	let reconcile = (): void => {};

	const ensureScopeSubscription = (scopeId: string): ScopeState => {
		const existing = scopeStates.get(scopeId);
		if (existing) return existing;

		const state: ScopeState = { active: undefined, unsubscribe: noop };
		scopeStates.set(scopeId, state);
		const query = client
			.query('scopes')
			.Where('id', '=', scopeId)
			.Where('isDeleted', '=', false)
			.Select(['id']);
		state.unsubscribe = client.subscribe(
			query,
			(values) => {
				if (disposed || scopeStates.get(scopeId) !== state) return;
				state.active = values.length > 0;
				reconcile();
			},
			onError
		);
		return state;
	};

	const ensureEdgeSubscription = (parentScopeId: string): EdgeState => {
		const existing = edgeStates.get(parentScopeId);
		if (existing) return existing;

		const state: EdgeState = { edges: undefined, unsubscribe: noop };
		edgeStates.set(parentScopeId, state);
		const query = client
			.query('intersections')
			.Where('kind', '=', 'child_of')
			.Where('isDeleted', '=', false)
			.Where('toId', '=', parentScopeId)
			.Select(['id', 'fromId', 'toId']);
		state.unsubscribe = client.subscribe(
			query,
			(values) => {
				if (disposed || edgeStates.get(parentScopeId) !== state) return;
				state.edges = normalizeHierarchyEdges(values);
				reconcile();
			},
			onError
		);
		return state;
	};

	reconcile = (): void => {
		if (disposed) return;
		const desiredScopeIds = new Set<string>([rootScopeId]);
		const desiredParentIds = new Set<string>();
		const reachable = new Set<string>();
		let loading = false;

		const rootState = ensureScopeSubscription(rootScopeId);
		if (rootState.active === undefined) {
			loading = true;
		} else if (rootState.active) {
			const pending = [rootScopeId];
			while (pending.length > 0) {
				const parentScopeId = pending.pop();
				if (!parentScopeId || reachable.has(parentScopeId)) continue;
				reachable.add(parentScopeId);
				desiredParentIds.add(parentScopeId);

				const edgeState = ensureEdgeSubscription(parentScopeId);
				if (edgeState.edges === undefined) {
					loading = true;
					continue;
				}
				for (const edge of edgeState.edges) {
					desiredScopeIds.add(edge.fromId);
					const childState = ensureScopeSubscription(edge.fromId);
					if (childState.active === undefined) {
						loading = true;
						continue;
					}
					if (childState.active) pending.push(edge.fromId);
				}
			}
		}

		for (const scopeId of [...scopeStates.keys()]) {
			if (!desiredScopeIds.has(scopeId)) removeScopeSubscription(scopeId);
		}
		for (const parentScopeId of [...edgeStates.keys()]) {
			if (!desiredParentIds.has(parentScopeId)) removeEdgeSubscription(parentScopeId);
		}
		if (loading) return;

		const resolvedScopeIds = sortedUnique(reachable);
		const key = idsKey(resolvedScopeIds);
		if (key === lastEmittedKey) return;
		lastEmittedKey = key;
		onScopeIds(resolvedScopeIds);
	};

	reconcile();

	return () => {
		disposed = true;
		for (const state of scopeStates.values()) state.unsubscribe();
		for (const state of edgeStates.values()) state.unsubscribe();
		scopeStates.clear();
		edgeStates.clear();
	};
};

export const subscribeScope = (
	client: TempienceTriplitClient,
	scope: NonNullable<TraceDatasetRequest['scope']>,
	onScopeIds: (ids: string[]) => void,
	onError: (cause: unknown) => void
): Unsubscribe =>
	scope.mode === 'direct'
		? subscribeDirectScope(client, scope.id, onScopeIds, onError)
		: subscribeSubtreeScope(client, scope.id, onScopeIds, onError);
