import type { ScopeIntent } from './types';

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

export const EMPTY_SCOPES: ScopeIntent = { initial: [], manual: [], kind: [], excluded: [] };

export const scopeIntent = (initial: readonly string[]): ScopeIntent => ({
	...EMPTY_SCOPES,
	initial: unique(initial)
});

/** The memberships the save will write: entry, manual and Kind contributions minus exclusions. */
export const selectedScopes = (intent: ScopeIntent): string[] =>
	unique([...intent.initial, ...intent.manual, ...intent.kind]).filter(
		(id) => !intent.excluded.includes(id)
	);

/** A manual choice; an earlier explicit removal of the same Scope is withdrawn. */
export const addScope = (intent: ScopeIntent, id: string): ScopeIntent => ({
	...intent,
	manual: unique([...intent.manual, id]),
	excluded: intent.excluded.filter((entry) => entry !== id)
});

/**
 * An explicit removal: whatever contributed the Scope, it stays out until the user adds it
 * again, including after a Kind change that would otherwise bring it back.
 */
export const removeScope = (intent: ScopeIntent, id: string): ScopeIntent => ({
	...intent,
	manual: intent.manual.filter((entry) => entry !== id),
	excluded: unique([...intent.excluded, id])
});

/** The chosen Kind's direct Scopes replace only the previous Kind's contribution. */
export const replaceKindScopes = (
	intent: ScopeIntent,
	kindScopeIds: readonly string[]
): ScopeIntent => ({
	...intent,
	kind: unique(kindScopeIds)
});

/** The Kinds directly bound to any of the given Scopes, in catalog order; subtrees never count. */
export const kindsInScopes = <T extends { id: string }>(
	kinds: readonly T[],
	kindScopes: ReadonlyMap<string, readonly string[]>,
	scopeIds: readonly string[]
): T[] =>
	scopeIds.length === 0
		? []
		: kinds.filter((kind) => (kindScopes.get(kind.id) ?? []).some((id) => scopeIds.includes(id)));

export const sameScopeSet = (left: readonly string[], right: readonly string[]): boolean =>
	left.length === right.length && new Set(left).size === new Set([...left, ...right]).size;
