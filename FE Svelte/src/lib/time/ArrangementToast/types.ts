import type { ArrangementState } from '$lib/state/Arrangement/Arrangement.svelte';

export type ArrangementToastProps = Readonly<{
	arrangement: ArrangementState;
	/** Every Scope's name and «Без Scope», to name the merged row the toast speaks of. */
	scopesById: ReadonlyMap<string, Readonly<{ name: string }>>;
}>;
