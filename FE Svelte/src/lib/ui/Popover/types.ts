import type { Snippet } from 'svelte';
export type PopoverProps = {
	id: string;
	label: string;
	trigger: Snippet;
	children: Snippet<[close: () => void]>;
	testId?: string;
	class?: string;
};
export type Rect = { left: number; right: number; top: number; bottom: number };
