import type { DemoStoryEntry } from '$lib/scenarios/demo/registry';

/** `cards` for the tour and the first Scope, `list` for the local-data menu. */
export type DemoStoriesVariant = 'cards' | 'list';

export type DemoStoriesProps = {
	/** The stories to offer; by default every story written in the interface language. */
	entries?: readonly DemoStoryEntry[];
	/** Opens one story: the host reloads the app into its space. */
	onopen: (entry: DemoStoryEntry) => void;
	variant: DemoStoriesVariant;
	/** While the host is busy opening one, every offer is disabled. */
	busy?: boolean;
	/** The story already open: its notice and its «Удалить демо» live elsewhere, so it is not offered. */
	activeId?: string;
};
