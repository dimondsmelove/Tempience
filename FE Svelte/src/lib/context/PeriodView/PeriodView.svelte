<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import type { MessageKey } from '$lib/state/Locale/types';
	import { CHIP_CLASS, LIST_BUTTON_CLASS } from '$lib/context/constants';
	import { formatDay } from '$lib/context/labels';
	import { periodTitle } from '$lib/model/Axis/Axis';
	import type { PeriodRef } from '$lib/model/Axis/types';
	import { periodContext, periodDraftTime } from '$lib/model/PeriodContext/PeriodContext';
	import { tempienceRepository } from '$lib/state/triplit';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { UNIT_KEYS } from './constants';

	let { workbench, period }: { workbench: WorkbenchState; period: PeriodRef } = $props();
	const context = $derived(periodContext(workbench.view, period, workbench.projectionInputs));
	let draft = $state('');
	let editing = $state(false);
	let busy = $state(false);
	let notice = $state<MessageKey | null>(null);
	let failure = $state.raw<unknown>(null);
	const edit = (): void => {
		draft = context.note ?? '';
		editing = true;
		notice = null;
		failure = null;
	};
	/** The note lives on the persisted Period; the first note creates it for this calendar period. */
	const save = async (): Promise<void> => {
		busy = true;
		notice = null;
		failure = null;
		try {
			const note = draft.trim() || null;
			if (context.record) await tempienceRepository.editPeriod(context.record.id, { note });
			else if (note)
				await tempienceRepository.createPeriod({
					name: context.title,
					time: periodDraftTime(period),
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					note
				});
			await workbench.load(loadWorkbenchSnapshot);
			editing = false;
			notice = 'period.noteSaved';
		} catch (cause) {
			failure = cause ?? new Error();
		} finally {
			busy = false;
		}
	};
	const go = (ref: PeriodRef): void => workbench.selectPeriod(ref, 'context');
</script>

<section class="flex flex-col gap-3" data-testid="context-period">
	<span class="font-mono text-xs text-muted"
		>{t('period.records', { unit: t(UNIT_KEYS[period.unit]), count: context.traceCount })}</span
	>
	<h2 class="text-lg leading-tight font-semibold" data-testid="selected-title">{context.title}</h2>
	<div class="flex flex-col gap-1" data-testid="period-note">
		{#if editing}
			<textarea
				class="cg-field min-h-24 w-full text-sm"
				aria-label={t('period.note')}
				bind:value={draft}
				disabled={busy}></textarea>
			<div class="flex gap-1">
				<Button size="sm" variant="primary" disabled={busy} onclick={save}
					>{t('period.save')}</Button
				>
				<Button size="sm" variant="quiet" disabled={busy} onclick={() => (editing = false)}
					>{t('common.cancel')}</Button
				>
			</div>
		{:else if context.note}
			<p class="text-sm whitespace-pre-wrap">{context.note}</p>
			<div><Button size="sm" variant="quiet" onclick={edit}>{t('period.editNote')}</Button></div>
		{:else}
			<div><Button size="sm" variant="quiet" onclick={edit}>{t('period.addNote')}</Button></div>
		{/if}
		{#if failure !== null}<p class="text-xs text-muted" role="alert">{errorText(failure)}</p>
		{:else if notice}<p class="text-xs text-muted" role="status">{t(notice)}</p>{/if}
	</div>
	<div class="flex flex-col gap-1">
		<h3 class="cg-label">{t('period.byScope')}</h3>
		{#if context.groups.length}
			{#each context.groups as group (group.scopeId ?? 'none')}
				<h4 class="mt-1 text-sm font-medium">
					{group.name} <span class="font-mono text-xs text-muted">{group.traces.length}</span>
				</h4>
				<ul class="flex flex-col gap-1">
					{#each group.traces as item (item.traceId)}
						<li>
							<button
								type="button"
								class={LIST_BUTTON_CLASS}
								data-testid="period-record"
								data-trace-id={item.traceId}
								onclick={() => workbench.selectTrace(item.traceId, 'context')}
							>
								<span class="font-mono text-xs text-muted">{formatDay(item.time.start)}</span>
								<span>{item.label}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/each}
		{:else}
			<p class="text-sm text-muted">{t('period.empty')}</p>
		{/if}
	</div>
	{#if context.activeScopeIds.length}
		<div class="flex flex-col gap-1">
			<h3 class="cg-label">{t('period.activeScopes')}</h3>
			<div class="flex flex-wrap gap-1">
				{#each context.groups.filter((group) => group.scopeId) as group (group.scopeId)}
					<span class={CHIP_CLASS}>{group.name}</span>
				{/each}
			</div>
		</div>
	{/if}
	<div class="flex flex-col gap-1">
		<h3 class="cg-label">{t('period.neighborhood')}</h3>
		<div class="flex flex-wrap gap-1">
			<Button size="sm" data-testid="period-previous" onclick={() => go(context.neighbors.previous)}
				>← {periodTitle(context.neighbors.previous, locale.current)}</Button
			>
			{#if context.neighbors.parent}
				{@const parent = context.neighbors.parent}
				<Button size="sm" data-testid="period-parent" onclick={() => go(parent)}
					>↑ {periodTitle(parent, locale.current)}</Button
				>
			{/if}
			<Button size="sm" data-testid="period-next" onclick={() => go(context.neighbors.next)}
				>{periodTitle(context.neighbors.next, locale.current)} →</Button
			>
		</div>
		{#if context.neighbors.children.length}
			<div class="flex flex-wrap gap-1">
				{#each context.neighbors.children as child (child.start)}
					<button
						type="button"
						class={CHIP_CLASS + ' cursor-pointer hover:text-ink'}
						onclick={() => go(child)}>{periodTitle(child, locale.current)}</button
					>
				{/each}
			</div>
		{/if}
	</div>
</section>
