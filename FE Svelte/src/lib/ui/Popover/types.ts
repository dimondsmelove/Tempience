import type { Snippet } from 'svelte';
import type { ButtonVariant } from '$lib/ui/Button/types';
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
	/** Disable the trigger when its action is unavailable. */
	disabled?: boolean;
	/** The trigger's look, as `Button`'s `variant`; quiet by default. */
	variant?: ButtonVariant;
	/** The trigger is a toggle in its on state, as `Button`'s `pressed`. */
	pressed?: boolean;
	/** Observe the native popover state, for lazy content. */
	ontoggle?: (open: boolean) => void;
};
export type Rect = { left: number; right: number; top: number; bottom: number };
