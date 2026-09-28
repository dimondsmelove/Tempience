import type { Snippet } from 'svelte';

export type EditorShellProps = Readonly<{
	heading: string;
	testId: string;
	/** A write under way: every field and button waits. */
	busy?: boolean;
	/** The fields. */
	children: Snippet;
	/** Refusals and notices, under the fields. */
	alerts?: Snippet;
	/** Save first, then cancel, then anything else. */
	actions: Snippet;
}>;
