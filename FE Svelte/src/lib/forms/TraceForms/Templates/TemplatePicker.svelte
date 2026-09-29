<script lang="ts">
	import { TEMPLATE_IDS, type TemplateId } from '$lib/model/TraceForm/templates';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { MessageKey } from '$lib/state/Locale/types';

	let { onpick }: { onpick: (id: TemplateId | 'scratch') => void } = $props();
	const choices = [...TEMPLATE_IDS, 'scratch'] as const;
</script>

<!-- The first question of a new Kind is what it records (owner, 2026-09-29): trackers offer
     kinds of things to log, and the builder stays for whatever the kinds do not cover. -->
<section class="grid min-w-0 gap-3" aria-labelledby="template-pick" data-testid="template-picker">
	<h3 id="template-pick" class="text-sm">{t('template.pick')}</h3>
	<div class="grid min-w-0 gap-2 sm:grid-cols-2">
		{#each choices as id (id)}
			<button
				type="button"
				class={['template', id === 'scratch' && 'scratch']}
				data-testid={`template-${id}`}
				onclick={() => onpick(id)}
			>
				<span class="font-medium">{t(`template.${id}` as MessageKey)}</span>
				<span class="text-xs text-muted">{t(`template.${id}Hint` as MessageKey)}</span>
			</button>
		{/each}
	</div>
</section>

<style>
	.template {
		display: grid;
		gap: 0.125rem;
		padding: 0.625rem 0.75rem;
		text-align: left;
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-surface);
		background: var(--cg-bg-raised);
		cursor: pointer;
	}
	.template:hover,
	.template:focus-visible {
		border-color: var(--cg-accent);
	}
	.template.scratch {
		border-style: dashed;
		background: transparent;
	}
</style>
