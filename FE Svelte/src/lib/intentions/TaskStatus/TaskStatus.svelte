<script lang="ts">
	import ResponsiveMenu from '$lib/ui/ResponsiveMenu/ResponsiveMenu.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import OutcomeIcon from '../OutcomeIcon/OutcomeIcon.svelte';
	import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
	import { OUTCOMES, outcomeLabel } from './constants';
	import { selectOpen, selectOutcome } from './selection';
	import type { TaskOutcomeChoice } from './types';
	let {
		open,
		outcome,
		setOpen,
		setOutcome
	}: {
		open: boolean;
		outcome: IntentionOutcome | null | undefined;
		setOpen: (value: boolean) => void;
		setOutcome: (value: TaskOutcomeChoice) => void;
	} = $props();
	const id = $props.id();
</script>

<div class="status-line">
	<ResponsiveMenu id={`${id}-open`} label={t(open ? 'result.stateOpen' : 'result.stateClosed')}>
		{#snippet trigger()}{t(open ? 'result.stateOpen' : 'result.stateClosed')}
			<span aria-hidden="true">⌄</span>{/snippet}
		{#snippet children(close)}
			<div class="menu" role="menu">
				{#each [true, false] as value (String(value))}
					<button
						type="button"
						role="menuitemradio"
						aria-checked={open === value}
						onclick={() => {
							close();
							selectOpen(open, value, setOpen);
						}}
					>
						<span class="label">{t(value ? 'result.stateOpen' : 'result.stateClosed')}</span
						>{#if open === value}<span aria-hidden="true">✓</span>{/if}
					</button>
				{/each}
			</div>
		{/snippet}
	</ResponsiveMenu>
	<span aria-hidden="true">·</span>
	<ResponsiveMenu id={`${id}-outcome`} label={t(outcomeLabel(outcome))}>
		{#snippet trigger()}{#if outcome}<OutcomeIcon {outcome} size={14} />{/if}{t(
				outcomeLabel(outcome)
			)} <span aria-hidden="true">⌄</span>{/snippet}
		{#snippet children(close)}
			<div class="menu" role="menu">
				{#each OUTCOMES as value (value)}
					<button
						type="button"
						role="menuitemradio"
						aria-checked={(outcome ?? 'none') === value}
						onclick={() => {
							close();
							(
								document.querySelector(`[popovertarget="${id}-outcome"]`) as HTMLElement | null
							)?.focus();
							selectOutcome(outcome, value, setOutcome);
						}}
					>
						{#if value !== 'none'}<OutcomeIcon outcome={value} size={14} />{:else}<span
								class="spacer"
							></span>{/if}
						<span class="label"
							>{t(
								value === 'partial' || value === 'alternative'
									? `intentions.preset.${value}`
									: outcomeLabel(value)
							)}</span
						>
						{#if (outcome ?? 'none') === value}<span aria-hidden="true">✓</span>{/if}
					</button>
				{/each}
			</div>
		{/snippet}
	</ResponsiveMenu>
</div>

<style>
	.status-line {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--cg-text-muted);
		font-size: 13px;
	}
	.status-line > :global(button) {
		min-height: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		gap: 4px;
		font-size: 13px;
	}
	.menu {
		min-width: 210px;
		padding: 4px;
	}
	.menu button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 32px;
		padding: 0 8px;
		text-align: left;
		cursor: pointer;
		border-radius: var(--cg-radius-control);
		font-size: 13px;
	}
	.menu button:hover,
	.menu button:focus-visible {
		background: var(--cg-bg-raised);
	}
	.menu .label {
		flex: 1;
	}
	.spacer {
		width: 14px;
		flex: none;
	}
	@media (max-width: 800px) {
		.menu {
			padding: 0 16px 16px;
		}
		.menu button {
			min-height: 48px;
			font-size: 16px;
		}
	}
</style>
