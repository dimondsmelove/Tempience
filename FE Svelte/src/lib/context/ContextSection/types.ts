import type { Snippet } from 'svelte';

export type ContextSectionProps = Readonly<{
	/** The section's id: `context-section-<id>` and `section-toggle-<id>` name it for the tests. */
	id: string;
	/** Its name, as the toggle says it. */
	label: string;
	/** Its heading, when it says more than the name (a count). */
	title?: string;
	collapsed: boolean;
	ontoggle: () => void;
	/** The first section of the Context draws no rule above it. */
	flushFirst?: boolean;
	children: Snippet;
}>;
