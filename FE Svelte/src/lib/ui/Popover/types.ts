import type { Snippet } from 'svelte';
export type PopoverProps = {
	id: string;
	label: string;
	trigger: Snippet;
	children: Snippet<[close: () => void]>;
	testId?: string;
	class?: string;
	/** A square icon-only trigger, as `Button`'s `icon`. */
	icon?: boolean;
	/** The panel is a menu: the trigger says so to readers (`aria-haspopup`). */
	haspopup?: 'menu';
	/** The trigger's tooltip; the label otherwise names it to readers alone. */
	title?: string;
};
export type Rect = { left: number; right: number; top: number; bottom: number };
