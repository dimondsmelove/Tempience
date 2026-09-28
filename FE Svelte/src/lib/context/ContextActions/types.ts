import type { Snippet } from 'svelte';

export type ContextActionsProps = Readonly<{
	/** The row's name for a reader. */
	label: string;
	children: Snippet;
}>;
