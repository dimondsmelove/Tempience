<script lang="ts">
	import { ChevronDownOutline, ChevronRightOutline } from 'flowbite-svelte-icons';
	import { SECTION_HEADING_CLASS } from '$lib/context/constants';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import type { ContextSectionProps } from './types';

	let {
		id,
		label,
		title = label,
		collapsed,
		ontoggle,
		flushFirst = false,
		children
	}: ContextSectionProps = $props();
</script>

<!-- A part of a Context: its heading and the toggle that folds it; the fold is remembered by
     the Context's own FoldedSections. -->
<section
	class={[
		'flex flex-col gap-2 border-t border-outline pt-2',
		flushFirst && 'first:border-t-0 first:pt-0'
	]}
	id={`context-section-${id}`}
	data-testid={`context-section-${id}`}
>
	<div class="flex items-center justify-between gap-1">
		<h3 class={SECTION_HEADING_CLASS}>{title}</h3>
		<Button
			size="sm"
			variant="quiet"
			icon
			aria-expanded={!collapsed}
			aria-label={collapsed
				? t('context.expand', { section: label })
				: t('context.collapse', { section: label })}
			data-testid={`section-toggle-${id}`}
			onclick={ontoggle}
		>
			{#if collapsed}<ChevronRightOutline class="h-4 w-4" />{:else}<ChevronDownOutline
					class="h-4 w-4"
				/>{/if}
		</Button>
	</div>
	{#if !collapsed}{@render children()}{/if}
</section>
