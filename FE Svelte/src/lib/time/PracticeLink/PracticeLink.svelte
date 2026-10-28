<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ClockOutline } from 'flowbite-svelte-icons';
	import {
		BUTTON_BASE_CLASS,
		BUTTON_SIZE_CLASS,
		BUTTON_VARIANT_CLASS
	} from '$lib/ui/Button/constants';
	import { t } from '$lib/state/Locale/Locale.svelte';

	let { phone = false }: { phone?: boolean } = $props();
	const href = resolve('/practice');
	const current = $derived(page.url.pathname.startsWith(href) ? 'page' : undefined);
</script>

{#if phone}
	<a class="mobile-action" {href} aria-current={current} data-testid="practice-open"
		><ClockOutline class="h-5 w-5" /><span>{t('toolbar.practice')}</span></a
	>
{:else}
	<a
		class={[BUTTON_BASE_CLASS, BUTTON_VARIANT_CLASS.default, BUTTON_SIZE_CLASS.sm]}
		{href}
		aria-current={current}
		title={t('toolbar.practiceHint')}
		data-testid="practice-open">{t('toolbar.practice')}</a
	>
{/if}

<style>
	.mobile-action {
		display: flex;
		min-width: 0;
		min-height: 48px;
		flex-direction: column;
		gap: 3px;
		align-items: center;
		justify-content: center;
		font-size: var(--cg-text-size-caption);
		color: var(--cg-text-muted);
	}
	.mobile-action:focus-visible {
		outline: 2px solid var(--cg-accent);
	}
	.mobile-action[aria-current='page'] {
		color: var(--cg-accent);
	}
</style>
