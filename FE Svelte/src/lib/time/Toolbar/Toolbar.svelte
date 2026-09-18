<script lang="ts">
	import { CATALOG_KEY } from '$lib/state/Forms/constants';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import {
		BarsOutline,
		FilterOutline,
		CalendarMonthOutline,
		ClipboardListOutline,
		MapPinAltOutline,
		PlusOutline
	} from 'flowbite-svelte-icons';
	import Legend from '$lib/time/Legend/Legend.svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import { TOOLBAR_HEIGHT_PX } from '$lib/time/Workbench/constants';
	import Button from '$lib/ui/Button/Button.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { ToolbarProps } from './types';

	let {
		workbench,
		phone = false,
		railOpen,
		contextOpen,
		ontogglepanel,
		oncapture,
		onapply,
		scenarioSpace
	}: ToolbarProps = $props();
	const viewport = $derived(workbench.viewport);

	const filterCount = $derived(workbench.filters.activeCount);
	/** The Trace Kind catalog opens in the Context from the timeline's own toolbar (ANSWERS 2026-09-15). */
	const openKinds = (): void =>
		draftGuard.exit(() => {
			workbench.capture = false;
			workbench.forms.showCatalog(workbench.forms.data?.kindId);
			ontogglepanel('context', true);
		});
</script>

{#if phone}
	<nav
		class="mobile-actions border-t border-outline bg-surface"
		aria-label={t('toolbar.actions')}
		data-testid="mobile-actions"
	>
		<button class="mobile-action" onclick={() => ontogglepanel('rail', true)}
			><BarsOutline class="h-5 w-5" /><span>Scope</span></button
		>
		{#if workbench.forms.data}
			<button class="mobile-action" onclick={() => workbench.forms.showTimeline()}
				><CalendarMonthOutline class="h-5 w-5" /><span>{t('kindHistory.timeline')}</span></button
			>
			<button class="mobile-action" data-testid="kinds-open" onclick={openKinds}
				><ClipboardListOutline class="h-5 w-5" /><span>{t(CATALOG_KEY)}</span></button
			>
		{:else}
			<button class="mobile-action" data-testid="kinds-open" onclick={openKinds}
				><ClipboardListOutline class="h-5 w-5" /><span>{t(CATALOG_KEY)}</span></button
			>
			<button
				class="mobile-action"
				data-testid="filters-toggle"
				onclick={() => ontogglepanel('filters', true)}
				><FilterOutline class="h-5 w-5" /><span>{t('toolbar.filters')}</span>{#if filterCount}<span
						class="badge">{filterCount}</span
					>{/if}</button
			>
			<button class="mobile-action" onclick={() => ontogglepanel('parked', true)}
				><CalendarMonthOutline class="h-5 w-5" /><span>{t('toolbar.parked')}</span
				>{#if workbench.projection.parked.length}<span class="badge"
						>{workbench.projection.parked.length}</span
					>{/if}</button
			>
		{/if}
		<Button variant="primary" class="mobile-capture" data-testid="capture" onclick={oncapture}
			><PlusOutline class="h-5 w-5" /><span>{t('toolbar.record')}</span></Button
		>
	</nav>
{:else}
	<div
		class="cg-toolbar flex shrink-0 flex-wrap items-center border-b border-outline bg-surface py-1"
		style:min-height="{TOOLBAR_HEIGHT_PX}px"
		data-testid="time-toolbar"
	>
		{#if !railOpen}<Button size="sm" onclick={() => ontogglepanel('rail', true)}>Scope</Button>{/if}
		{#if !contextOpen}<Button size="sm" onclick={() => ontogglepanel('context', true)}
				>Context</Button
			>{/if}
		<div class="grow"></div>
		{#if workbench.forms.data}
			<Button size="sm" onclick={() => workbench.forms.showTimeline()}
				>{t('kindHistory.timeline')}</Button
			>
			<Button size="sm" data-testid="kinds-open" onclick={openKinds}>{t(CATALOG_KEY)}</Button>
		{/if}
		{#if !workbench.forms.data}
			<Popover
				id="time-filters"
				label={filterCount
					? t('toolbar.filtersCount', { count: filterCount })
					: t('toolbar.filters')}
				testId="filters-toggle"
			>
				{#snippet trigger()}
					{t('toolbar.filters')}
					{#if filterCount}<span
							class="font-mono rounded-[var(--cg-radius-control)] bg-[var(--cg-accent-secondary)] px-1 text-[color:var(--cg-text-on-secondary)]"
							data-testid="filters-count">{filterCount}</span
						>{/if} ▾
				{/snippet}
				{#snippet children(close)}
					<div class="flex w-64 max-w-full flex-col gap-3">
						<Legend filters={workbench.filters} scopes={workbench.snapshot.scopes} />
						<Button
							size="sm"
							variant="quiet"
							disabled={filterCount === 0}
							data-testid="filters-reset"
							onclick={() => {
								workbench.filters.reset();
								close();
							}}>{t('toolbar.resetAll')}</Button
						>
					</div>
				{/snippet}
			</Popover>
			<Button
				size="sm"
				variant="quiet"
				pressed={viewport.follow}
				title={t('toolbar.live')}
				onclick={() => viewport.toggleFollow()}
			>
				<span
					aria-hidden="true"
					class={[
						'h-1.5 w-1.5 rounded-full',
						viewport.follow ? 'animate-pulse bg-accent motion-reduce:animate-none' : 'bg-muted'
					]}
				></span>
				Live
			</Button>
			<Button
				size="sm"
				icon
				disabled={!workbench.selectedRange}
				aria-label={t('toolbar.toSelected')}
				title={t('toolbar.toSelectedHint')}
				data-testid="go-to-selected"
				onclick={() => workbench.goToSelected()}
			>
				<MapPinAltOutline class="h-4 w-4" />
			</Button>
			{#if workbench.proposalCounts.pending > 0}
				<span
					class="font-mono text-xs whitespace-nowrap rounded-[var(--cg-radius-control)] bg-[var(--cg-accent-secondary)] px-1 text-[color:var(--cg-text-on-secondary)]"
					data-testid="proposals-pending"
					>{t('toolbar.pending', { count: workbench.proposalCounts.pending })}</span
				>
			{/if}
			{#if workbench.proposalCounts.accepted > 0}
				<Button
					size="sm"
					data-testid="apply-proposals"
					disabled={!scenarioSpace}
					title={t('toolbar.applyHint')}
					onclick={onapply}
					>{t('toolbar.apply', { count: workbench.proposalCounts.accepted })}</Button
				>
			{/if}
			<!-- The catalog sits next to «Записать»: both are entries into the Context (owner, 2026-09-17). -->
			<Button size="sm" data-testid="kinds-open" onclick={openKinds}>{t(CATALOG_KEY)}</Button>
		{/if}
		<Button size="sm" variant="primary" data-testid="capture" onclick={oncapture}>
			<PlusOutline class="h-4 w-4" />
			{t('toolbar.record')}
		</Button>
	</div>
{/if}

<style>
	.mobile-actions {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: 0.25rem;
		align-items: center;
		padding: 0.25rem 0.375rem calc(0.25rem + env(safe-area-inset-bottom, 0px));
		z-index: 45;
		min-height: 3.75rem;
	}
	.mobile-action {
		position: relative;
		display: flex;
		min-width: 0;
		min-height: 48px;
		flex-direction: column;
		gap: 3px;
		align-items: center;
		justify-content: center;
		font-size: var(--cg-text-size-caption);
		color: var(--cg-text-muted);
		cursor: pointer;
	}
	.mobile-action:focus-visible {
		outline: 2px solid var(--cg-accent);
	}
	.badge {
		position: absolute;
		top: 0;
		right: 12%;
		border-radius: var(--cg-radius-control);
		padding-inline: 0.25rem;
		color: var(--cg-text-on-secondary);
		background: var(--cg-accent-secondary);
		font: inherit;
	}
	.mobile-actions :global(.mobile-capture) {
		min-height: 48px;
		min-width: 0;
		padding-inline: 0.375rem;
		font-size: var(--cg-text-size-control);
		gap: 0.25rem;
	}
	@media (max-width: 380px) {
		.mobile-actions :global(.mobile-capture svg) {
			display: none;
		}
	}
</style>
