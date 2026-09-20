<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import type { RailMenuProps } from './types';

	let { arrangement }: RailMenuProps = $props();

	/** The enabled items of the menu, in order. */
	const items = (menu: HTMLElement): HTMLButtonElement[] => [
		...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
	];
	/** Arrow keys walk the items, Home and End jump to the ends; Escape is the popover's own. */
	const onkeydown = (event: KeyboardEvent): void => {
		const menu = event.currentTarget as HTMLElement;
		const enabled = items(menu);
		const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
		const target =
			event.key === 'ArrowDown'
				? (index + 1) % enabled.length
				: event.key === 'ArrowUp'
					? (index - 1 + enabled.length) % enabled.length
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? enabled.length - 1
							: -1;
		if (target < 0 || !enabled.length) return;
		event.preventDefault();
		enabled[target].focus();
	};
	/** The menu opened: the first enabled item takes the focus, as a menu does. */
	const focusFirst = (menu: HTMLElement): (() => void) => {
		const panel = menu.closest('[popover]');
		const onToggle = (event: Event): void => {
			if ((event as ToggleEvent).newState === 'open') items(menu)[0]?.focus();
		};
		panel?.addEventListener('toggle', onToggle);
		return () => panel?.removeEventListener('toggle', onToggle);
	};
</script>

<!-- «⋯» in the rail header (loop 006 C3, Q6): «Схлопнуть всё» — the whole ribbon as one row, the
     extreme case of the merge (research п. 7) — «Разделить всё» and «Сбросить порядок». An item that
     would change nothing is disabled; every item is taken back through the toast and Ctrl+Z (Q4-A). -->
<Popover
	id="rail-menu"
	label={t('rail.menu')}
	title={t('rail.menu')}
	icon
	haspopup="menu"
	testId="rail-menu"
>
	{#snippet trigger()}⋯{/snippet}
	{#snippet children(close)}
		<div
			class="flex min-w-44 flex-col p-1"
			role="menu"
			tabindex="-1"
			aria-label={t('rail.menu')}
			{onkeydown}
			{@attach focusFirst}
		>
			<Button
				size="sm"
				variant="quiet"
				class="justify-start"
				role="menuitem"
				disabled={!arrangement.canCollapse}
				data-testid="rail-collapse-all"
				onclick={() => {
					arrangement.collapseAll();
					close();
				}}>{t('rail.collapseAll')}</Button
			>
			<Button
				size="sm"
				variant="quiet"
				class="justify-start"
				role="menuitem"
				disabled={!arrangement.canSplitAll}
				data-testid="rail-split-all"
				onclick={() => {
					arrangement.splitAll();
					close();
				}}>{t('rail.splitAll')}</Button
			>
			<Button
				size="sm"
				variant="quiet"
				class="justify-start"
				role="menuitem"
				disabled={!arrangement.canReset}
				data-testid="rail-reset-order"
				onclick={() => {
					arrangement.reset();
					close();
				}}>{t('rail.resetOrder')}</Button
			>
		</div>
	{/snippet}
</Popover>
