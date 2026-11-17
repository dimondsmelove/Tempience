import type { Snippet } from 'svelte';

export type SidePanelProps = {
	open: boolean;
	title: string;
	canBack: boolean;
	canForward: boolean;
	position: { n: number | null; m: number };
	onback: () => void;
	onforward: () => void;
	onclose: () => void;
	/** A selector for what the panel stands under; the app's identity bar when left out. */
	below?: string;
	children: Snippet;
};
