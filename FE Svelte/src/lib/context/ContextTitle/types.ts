import type { Snippet } from 'svelte';

export type ContextTitleProps = Readonly<{
	title: string;
	/** The mono line above the name: counts, dates, a status. */
	meta?: string;
	/** The colour dot before the name (a Scope's flower, a chapter's dot). */
	dot?: Snippet;
	/** Line height of the name: a Scope's and a chapter's snug, a period's tight. */
	leading?: 'snug' | 'tight';
	/** The name is a way somewhere (a chapter's title: the whole chapter). */
	onclick?: () => void;
	/** What the name's click does, for the pointer and the reader. */
	actionLabel?: string;
}>;
