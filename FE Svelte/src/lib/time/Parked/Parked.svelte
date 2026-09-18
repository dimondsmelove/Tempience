<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { ChevronDownOutline, ChevronRightOutline } from 'flowbite-svelte-icons';
	import { ROW_HEIGHT_MIN_PX } from '$lib/model/Packing/constants';
	import Button from '$lib/ui/Button/Button.svelte';
	import { PARKED_REASON_KEYS, PARKED_ROW_KEY } from './constants';
	import { readParkedOpen, writeParkedOpen } from './open';
	import type { ParkedProps } from './types';

	let { traces, selectedTraceId, railOpen, onselect, list = false }: ParkedProps = $props();
	let open = $state(readParkedOpen());
	const toggle = (): void => {
		open = !open;
		writeParkedOpen(open);
	};
</script>

{#snippet name()}
	<button
		type="button"
		class="flex min-w-0 cursor-pointer items-center gap-1 rounded-[var(--cg-radius-control)] py-1 text-left text-sm font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
		aria-expanded={open}
		aria-label={open
			? t('parked.fold', { row: t(PARKED_ROW_KEY) })
			: t('parked.unfold', { row: t(PARKED_ROW_KEY) })}
		data-testid="parked-toggle"
		onclick={toggle}
	>
		{#if open}<ChevronDownOutline class="h-4 w-4 shrink-0" />
		{:else}<ChevronRightOutline class="h-4 w-4 shrink-0" />{/if}
		<span class="truncate">{t(PARKED_ROW_KEY)}</span>
	</button>
	<span
		class="shrink-0 font-mono text-xs rounded-[var(--cg-radius-control)] bg-[var(--cg-accent-secondary)] px-1 text-[color:var(--cg-text-on-secondary)]"
		data-testid="parked-count">{traces.length}</span
	>
{/snippet}

<!-- The last row of the ribbon (C9a-2, D3): records with no place on the axis, wrapped, never scrolled sideways. -->
{#if railOpen}
	<div
		class="col-start-1 row-start-3 flex items-center gap-1 overflow-hidden border-t border-r border-outline bg-canvas pr-2 pl-2 whitespace-nowrap"
		style:min-height="{ROW_HEIGHT_MIN_PX}px"
		data-testid="parked-name"
	>
		{@render name()}
	</div>
{/if}
<section
	class="col-start-2 row-start-3 flex min-w-0 flex-wrap items-center gap-1 border-t border-outline px-2 py-1"
	style:min-height="{ROW_HEIGHT_MIN_PX}px"
	aria-label={t(PARKED_ROW_KEY)}
	data-testid="parked-row"
>
	{#if !railOpen && !list}
		<div class="flex shrink-0 items-center gap-1 pr-2 whitespace-nowrap">{@render name()}</div>
	{/if}
	{#if list || open}
		<ul
			class={[
				'flex min-w-0 flex-1 gap-1',
				list ? 'flex-col items-stretch' : 'flex-wrap items-center'
			]}
			aria-label={t('parked.records')}
		>
			{#each traces as trace (trace.traceId)}
				<li>
					<Button
						size="sm"
						variant="quiet"
						class={list ? 'w-full justify-between text-left' : undefined}
						pressed={selectedTraceId === trace.traceId}
						data-trace-id={trace.traceId}
						data-testid="parked-chip"
						title={`${trace.label} · ${t(PARKED_REASON_KEYS[trace.reason])}`}
						aria-label={`${trace.label} · ${t(PARKED_REASON_KEYS[trace.reason])}`}
						onclick={() => onselect(trace.traceId)}
					>
						<span class={['max-w-48 truncate', trace.closed && 'text-muted']}>{trace.label}</span>
					</Button>
				</li>
			{:else}<li class="p-3 text-sm text-muted">{t('parked.empty')}</li>{/each}
		</ul>
	{/if}
</section>
