<script lang="ts">
	import ResponsiveMenu from '$lib/ui/ResponsiveMenu/ResponsiveMenu.svelte';
	import OutcomeIcon from '../OutcomeIcon/OutcomeIcon.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
	import type { ResultOutcome } from '../Outcome/types';
	let {
		outcome = null,
		open,
		activate,
		preset
	}: {
		outcome?: IntentionOutcome | null;
		open: boolean;
		activate: () => void;
		preset: (value: 'completed' | 'none' | 'not_completed' | ResultOutcome) => void;
	} = $props();
	const id = $props.id();
	const presets = ['completed', 'partial', 'alternative', 'not_completed', 'none'] as const;
</script>

<div class="circle">
	<button
		class="action"
		type="button"
		aria-label={t(open ? 'intentions.complete' : 'intentions.reopen')}
		onclick={activate}><OutcomeIcon {outcome} /></button
	>
	<span class="menu-trigger"
		><ResponsiveMenu {id} label={t('intentions.outcomeMenu')} icon>
			{#snippet trigger()}<span aria-hidden="true">⌄</span>{/snippet}
			{#snippet children(close)}
				<div
					class="menu"
					role="menu"
					tabindex="-1"
					onkeydown={(event) => {
						if (event.key === 'Escape') {
							event.preventDefault();
							event.stopPropagation();
							close();
							(document.querySelector(`[popovertarget="${id}"]`) as HTMLElement | null)?.focus();
						}
					}}
				>
					{#each presets as value (value)}
						<button
							type="button"
							role="menuitem"
							disabled={value === 'completed' && outcome === 'completed'}
							class:separator={value === 'not_completed'}
							onclick={() => {
								close();
								(document.querySelector(`[popovertarget="${id}"]`) as HTMLElement | null)?.focus();
								preset(value as 'completed' | 'partial' | 'alternative' | 'not_completed' | 'none');
							}}
						>
							{#if value !== 'none'}<OutcomeIcon
									outcome={value as IntentionOutcome}
									size={14}
								/>{:else}<span class="spacer"></span>{/if}
							<span>{t(`intentions.preset.${value}`)}</span>
							{#if value !== 'completed' && value !== 'partial'}
								<small>{t(`intentions.presetHint.${value}`)}</small>
							{/if}
						</button>
					{/each}
				</div>
			{/snippet}
		</ResponsiveMenu></span
	>
</div>

<style>
	.circle {
		display: grid;
		grid-template-columns: 16px 14px;
		column-gap: 4px;
		align-items: center;
	}
	.action {
		display: grid;
		place-items: center;
		width: 16px;
		height: 20px;
		padding: 0;
		cursor: pointer;
	}
	.action:focus-visible {
		outline: 2px solid var(--cg-accent);
		outline-offset: 2px;
	}
	.menu-trigger {
		display: inline-flex;
	}
	/* Only the arrow hides: the menu inside the same wrapper must stay hit-testable once open. */
	.menu-trigger > :global(button) {
		width: 14px;
		min-height: 20px;
		height: 20px;
		padding: 0;
		color: var(--cg-text-muted);
		visibility: hidden;
	}
	.circle:focus-within .menu-trigger > :global(button),
	.circle:has(:popover-open) .menu-trigger > :global(button),
	:global(article:focus-within) .menu-trigger > :global(button),
	:global(article:hover) .menu-trigger > :global(button) {
		visibility: visible;
	}
	.menu {
		min-width: 236px;
		padding: 4px;
	}
	.menu button {
		display: flex;
		width: 100%;
		min-height: 32px;
		align-items: center;
		gap: 8px;
		padding: 0 8px;
		font-size: 13px;
		text-align: left;
		color: var(--cg-text-primary);
		cursor: pointer;
		border-radius: var(--cg-radius-control);
	}
	.menu button:hover,
	.menu button:focus-visible {
		background: var(--cg-bg-raised);
	}
	.menu button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.separator {
		border-top: 1px solid var(--cg-border-default);
	}
	.spacer {
		width: 14px;
	}
	small {
		margin-left: auto;
		color: var(--cg-text-muted);
		font-size: 11px;
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
	@media (hover: none), (max-width: 800px) {
		.menu-trigger > :global(button) {
			visibility: visible;
		}
	}
</style>
