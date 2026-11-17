import type { Snippet } from 'svelte';

export type PanelHeaderProps = {
	title: string;
	position: { n: number | null; m: number } | null;
	canBack: boolean;
	canForward: boolean;
	onback: () => void;
	onforward: () => void;
	onclose: () => void;
	actions?: Snippet;
	dragHandle?: boolean;
	hidden?: boolean;
};
