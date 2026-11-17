<script lang="ts">
	import { CloseOutline } from 'flowbite-svelte-icons';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import type { PanelHeaderProps } from './types';
	import { PANEL_HEADER_CLASS } from './constants';

	let {
		title,
		position,
		canBack,
		canForward,
		onback,
		onforward,
		onclose,
		actions,
		dragHandle = false,
		hidden = false
	}: PanelHeaderProps = $props();
</script>

<!-- One line in every language: the buttons keep their size, the words give way. -->
<header
	class={[PANEL_HEADER_CLASS, hidden && 'time-context-heading']}
	data-sheet-drag-handle={dragHandle ? true : undefined}
>
	<span class="shrink-0 text-[length:var(--cg-text-size-control)] font-semibold">{title}</span>
	<Button
		size="sm"
		variant="quiet"
		icon
		aria-label={t('context.back')}
		disabled={!canBack}
		data-testid="history-back"
		onclick={onback}>←</Button
	>
	<span
		class="shrink-0 font-mono text-xs whitespace-nowrap text-muted"
		data-testid="history-position">{position?.n ?? '—'} / {position?.m ?? 0}</span
	>
	<Button
		size="sm"
		variant="quiet"
		icon
		aria-label={t('context.forward')}
		disabled={!canForward}
		data-testid="history-forward"
		onclick={onforward}>→</Button
	>
	<div class="min-w-0 grow"></div>
	{#if actions}{@render actions()}{/if}
	<Button
		size="sm"
		variant="quiet"
		icon
		class="shrink-0"
		aria-label={t('context.close')}
		title={t('context.close')}
		data-testid="context-collapse"
		onclick={onclose}
	>
		<CloseOutline class="h-4 w-4" />
	</Button>
</header>

<style>
	.time-context-heading {
		display: none;
	}
</style>
