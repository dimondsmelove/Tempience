<script lang="ts">
	import type {
		ExplorerIntersection,
		ExplorerScope,
		ExplorerTrace
	} from '$lib/model/Snapshot/types';
	import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeField from '$lib/ui/ScopeField/ScopeField.svelte';
	import ScopeDot from '$lib/ui/ScopeDot/ScopeDot.svelte';
	import { scopeOptionsOf } from '$lib/ui/ScopePicker';
	import { positionPopover } from '$lib/ui/Popover/position';
	import type { MoveTarget } from '../MoveIntention/types';
	import WhenDayPicker from '../WhenPopover/WhenDayPicker.svelte';
	import {
		dateLabel,
		formParentId,
		inheritedScopes,
		initialFormTarget,
		whenTarget,
		effectiveScopes,
		scopeIdsForCreate,
		submitCreateForm
	} from './createForm';

	let {
		initialTarget,
		weekStart,
		today,
		scopes,
		links,
		traces,
		add,
		onclose,
		lockedParentId
	}: {
		initialTarget: MoveTarget;
		weekStart: number;
		today: string;
		scopes: readonly ExplorerScope[];
		links: readonly ExplorerIntersection[];
		traces: readonly ExplorerTrace[];
		add: (
			title: string,
			target: MoveTarget,
			scopeIds?: readonly string[],
			parentId?: string
		) => Promise<string | null>;
		onclose: () => void;
		lockedParentId?: string;
	} = $props();
	const uid = $props.id();
	// The target is only the starting value; the form owns it afterwards.
	// svelte-ignore state_referenced_locally
	let target = $state(initialFormTarget(initialTarget, lockedParentId));
	let error = $state('');
	let title = $state(''),
		chosen = $state<string[] | null>(null),
		selectedParentId = $state<string | undefined>(),
		taskQuery = $state('');
	let titleInput: HTMLInputElement;
	let parentPanel = $state<HTMLDivElement>(null!);
	const parentId = $derived(formParentId(lockedParentId, selectedParentId));
	const parent = $derived(traces.find((trace) => trace.id === parentId));
	const inherited = $derived(inheritedScopes(parentId, scopes, links).map((scope) => scope.id));
	const selected = $derived(effectiveScopes(chosen, inherited));
	const options = $derived(scopeOptionsOf(scopes, links));
	const scopeOf = (id: string) => scopes.find((scope) => scope.id === id);
	const matches = $derived(
		traces
			.filter(
				(trace) =>
					isIntentionRelation(trace.relation) &&
					trace.intentOpen !== false &&
					trace.content.toLocaleLowerCase().includes(taskQuery.trim().toLocaleLowerCase())
			)
			.slice(0, 8)
	);
	const chooseParent = (id: string) => {
		selectedParentId = id;
		parentPanel.hidePopover();
		titleInput.focus();
	};
	const submit = async () => {
		const result = await submitCreateForm(() =>
			add(title, target, scopeIdsForCreate(chosen), parentId)
		);
		error = result.error;
		if (result.close) onclose();
	};
	const isWhen = (choice: 'today' | 'tomorrow' | 'week' | 'undated') => {
		const option = whenTarget(choice, today, weekStart);
		return (
			option.kind === target.kind &&
			(option.kind === 'day'
				? target.kind === 'day' && option.dayKey === target.dayKey
				: option.kind === 'week'
					? target.kind === 'week' && option.weekStart === target.weekStart
					: true)
		);
	};
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
	onsubmit={(event) => {
		event.preventDefault();
		void submit();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape' && !event.currentTarget.querySelector(':popover-open')) {
			event.stopPropagation();
			onclose();
		}
	}}
>
	<input
		class="title"
		{@attach (input) => {
			input.focus();
		}}
		bind:this={titleInput}
		bind:value={title}
		aria-label={t('intentions.input')}
		placeholder={t('intentions.input')}
	/>
	<div class="section">
		<span class="section-label">{t('intentions.when')}</span>
		<div class="choices">
			{#each ['today', 'tomorrow', 'week', 'undated'] as choice (choice)}
				{@const key = choice as 'today' | 'tomorrow' | 'week' | 'undated'}
				<Button
					size="sm"
					pressed={isWhen(key)}
					onclick={() => (target = whenTarget(key, today, weekStart))}
					>{t(
						key === 'today'
							? 'intentions.today'
							: key === 'tomorrow'
								? 'intentions.tomorrow'
								: key === 'week'
									? 'intentions.week'
									: 'intentions.undated'
					)}</Button
				>
			{/each}
			<WhenDayPicker
				value={target.kind === 'day' ? target.dayKey : ''}
				{today}
				label={t('intentions.dateMore')}
				variant="default"
				pressed={target.kind === 'day' && !isWhen('today') && !isWhen('tomorrow')}
				onpick={(value) => (target = { kind: 'day', dayKey: value })}
			>
				{target.kind === 'day' && !isWhen('today') && !isWhen('tomorrow')
					? `${t('intentions.dateMore')} · ${dateLabel(target, locale.current, t('intentions.week'), t('intentions.undated'))}`
					: t('intentions.dateMore')}
			</WhenDayPicker>
		</div>
	</div>
	<div class="section">
		<ScopeField
			label={t('intentions.where')}
			{options}
			ids={selected}
			{scopeOf}
			pickerLabel={t('draft.scopeChoose')}
			placeholder={t('draft.scopeAdd')}
			removeLabel={(name) => t('draft.scopeRemove', { name })}
			listLabel={t('draft.scopeSelected')}
			onadd={(id) => (chosen = [...selected, id])}
			onremove={(id) => (chosen = selected.filter((item) => item !== id))}
		/>
	</div>
	{#if !lockedParentId}
		<div class="parent-row">
			<Button popovertarget="{uid}-parent"
				>{parent ? parent.content.split('\n')[0] : t('intentions.partTask')}</Button
			>
			{#if parent}<Button
					variant="quiet"
					size="sm"
					icon
					aria-label={t('intentions.clearParent')}
					onclick={() => (selectedParentId = undefined)}>×</Button
				>{/if}
			<div
				id="{uid}-parent"
				class="popup"
				popover="auto"
				bind:this={parentPanel}
				{@attach positionPopover}
				role="dialog"
				aria-label={t('intentions.partTask')}
			>
				<input
					bind:value={taskQuery}
					aria-label={t('intentions.taskSearch')}
					placeholder={t('intentions.taskSearch')}
				/>
				{#each matches as task (task.id)}
					{@const taskScope = scopes.find((scope) =>
						links.some(
							(link) =>
								link.kind === 'belongs_to' && link.fromId === task.id && link.toId === scope.id
						)
					)}
					<Button variant="quiet" size="sm" class="option" onclick={() => chooseParent(task.id)}>
						{#if taskScope}<ScopeDot
								colorHue={taskScope.colorHue}
								colorChroma={taskScope.colorChroma}
								colorDepth={taskScope.colorDepth}
							/>{/if}{task.content.split('\n')[0]}
					</Button>
				{/each}
			</div>
		</div>
	{/if}
	{#if error}<p role="alert" class="error">{error}</p>{/if}
	<div class="footer">
		<span class="hint">{t('intentions.createHint')}</span><Button variant="primary" type="submit"
			>{t('intentions.create')}</Button
		>
	</div>
</form>

<style>
	form {
		min-width: 0;
		display: grid;
		gap: 10px;
		padding: 16px;
	}
	input.title {
		min-width: 0;
		width: 100%;
		border: 0;
		border-radius: 6px;
		background: var(--cg-bg-raised);
		padding: 7px;
		font-size: 17px;
		color: var(--cg-text-primary);
	}
	input:focus-visible {
		outline: 2px solid var(--cg-accent);
		outline-offset: 2px;
	}
	.section {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.section-label,
	.hint {
		font-size: 12px;
		color: var(--cg-text-muted);
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		align-items: center;
	}
	.error {
		color: var(--cg-text-muted);
		font-size: 13px;
	}
	.popup :global(.option) {
		width: 100%;
		justify-content: flex-start;
		text-align: left;
	}
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.hint {
		font-family: var(--cg-font-mono);
	}
	.popup {
		position: fixed;
		inset: auto;
		margin: 0;
		width: 240px;
		max-height: min(360px, 80vh);
		overflow: auto;
		padding: 6px;
		border: 1px solid var(--cg-border-default);
		border-radius: 6px;
		background: var(--cg-bg-surface);
		color: var(--cg-text-primary);
	}
	.popup input {
		width: 100%;
		padding: 6px;
		border: 1px solid var(--cg-border-default);
		border-radius: 3px;
		background: var(--cg-bg-raised);
		color: var(--cg-text-primary);
	}
</style>
