import type { Snippet } from 'svelte';
import type { HoverTarget } from '$lib/model/Hover/types';

/** One entity under or beside the one in the Context: a period's children, a chapter's stages. */
export type ChildItem = Readonly<{
	key: string;
	label: string;
	/** What it lights on the ribbon under the pointer. */
	lens: HoverTarget;
	/** It is the one in force now (a chapter's chosen or current stage). */
	current?: boolean;
	/** It carries a note (a period's accent dot). */
	noted?: boolean;
}>;

export type ChildListProps<T extends ChildItem> = Readonly<{
	items: readonly T[];
	testId: string;
	onpick: (item: T) => void;
	/** Before the label (a period's note dot). */
	lead?: Snippet<[T]>;
}>;
