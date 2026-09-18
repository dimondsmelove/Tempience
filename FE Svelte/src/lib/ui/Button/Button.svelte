<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import {
		BUTTON_BASE_CLASS,
		BUTTON_ICON_CLASS,
		BUTTON_PRESSED_CLASS,
		BUTTON_SIZE_CLASS,
		BUTTON_VARIANT_CLASS
	} from './constants';
	import type { ButtonSize, ButtonVariant } from './types';

	type Props = HTMLButtonAttributes & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		/** Square button holding only an icon; pair with `aria-label`. */
		icon?: boolean;
		/** Toggle state; renders `aria-pressed` and the pressed look. */
		pressed?: boolean;
		children?: Snippet;
	};

	let {
		variant = 'default',
		size = 'md',
		icon = false,
		pressed,
		class: className,
		children,
		type = 'button',
		...rest
	}: Props = $props();
</script>

<button
	{type}
	aria-pressed={pressed}
	class={[
		BUTTON_BASE_CLASS,
		BUTTON_VARIANT_CLASS[variant],
		BUTTON_SIZE_CLASS[size],
		icon && BUTTON_ICON_CLASS[size],
		pressed && BUTTON_PRESSED_CLASS,
		className
	]}
	{...rest}
>
	{@render children?.()}
</button>
