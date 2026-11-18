<script lang="ts">
	import ResponsiveMenu from '$lib/ui/ResponsiveMenu/ResponsiveMenu.svelte';
	import OutcomeIcon from '../OutcomeIcon/OutcomeIcon.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
	import type { ResultOutcome } from '../Outcome/types';
	import DatePopover from '../Board/DatePopover.svelte';
	import { repeatDays } from '../RepeatIntention/targets';
	import { locale } from '$lib/state/Locale/Locale.svelte';
	import { CalendarMonthOutline } from 'flowbite-svelte-icons';
	let {
		outcome = null,
		open,
		activate,
		preset,
		repeat = () => {},
		zone = 'UTC'
	}: {
		outcome?: IntentionOutcome | null;
		open: boolean;
		activate: () => void;
		preset: (value: 'completed' | 'none' | 'not_completed' | ResultOutcome) => void;
		repeat?: (day: string, now: number) => void;
		zone?: string;
	} = $props();
	const id = $props.id();
	const presets = ['completed', 'partial', 'alternative', 'not_completed', 'none'] as const;
	let repeatNow = $state(0);
	let repeatStep = $state(false);
	const openMenu = () => {
		repeatNow = Date.now();
		repeatStep = false;
	};
	const destinations = () => repeatDays(repeatNow || Date.now(), zone);
	const dayLabel = (day: string) => {
		const parts = new Intl.DateTimeFormat(locale.current, {
			weekday: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		}).formatToParts(new Date(`${day}T12:00:00Z`));
		return `${parts.find((part) => part.type === 'weekday')?.value ?? ''} ${parts.find((part) => part.type === 'day')?.value ?? ''}`;
	};
</script>

<div class="circle">
	<button
		class="action"
		type="button"
		aria-label={t(open ? 'intentions.complete' : 'intentions.reopen')}
		onclick={activate}><OutcomeIcon {outcome} /></button
	>
	<span class="menu-trigger"
		><ResponsiveMenu {id} label={t('intentions.outcomeMenu')} icon onopen={openMenu}>
			{#snippet trigger()}<span aria-hidden="true">⌄</span>{/snippet}
			{#snippet children(close)}
				<div
					class="menu"
					hidden={repeatStep}
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
								<small class="preset-hint">{t(`intentions.presetHint.${value}`)}</small>
							{/if}
						</button>
						{#if value === 'completed'}
							<button type="button" role="menuitem" onclick={() => (repeatStep = true)}>
								<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
									><path
										d="M2.5 7.5v-1a2 2 0 012-2h7M10 2.5l2 2-2 2M13.5 8.5v1a2 2 0 01-2 2h-7M6 13.5l-2-2 2-2"
										fill="none"
										stroke="currentColor"
										stroke-width="1.4"
										stroke-linecap="round"
										stroke-linejoin="round"
									/></svg
								>
								<span>{t('intentions.preset.repeat')}</span><small aria-hidden="true">›</small>
							</button>
						{/if}
					{/each}
				</div>
				<div hidden={!repeatStep}>{@render repeatOptions(close)}</div>
			{/snippet}
		</ResponsiveMenu></span
	>
</div>

{#snippet repeatOptions(parentClose: () => void)}
	<div class="menu repeat-options" role="menu">
		<button type="button" class="repeat-back" onclick={() => (repeatStep = false)}
			>‹ {t('intentions.preset.repeat')}</button
		>
		<div class="repeat-separator" aria-hidden="true"></div>
		{#each ['tomorrow', 'week'] as when (when)}
			{@const day = when === 'tomorrow' ? destinations().tomorrow : destinations().nextWeek}
			<button
				type="button"
				role="menuitem"
				onclick={() => {
					parentClose();
					repeat(day, Date.now());
				}}
				><span class="spacer"></span><span
					>{t(when === 'tomorrow' ? 'intentions.repeat.tomorrow' : 'intentions.repeat.week')}</span
				><small>{dayLabel(day)}</small></button
			>
		{/each}
		<div class="repeat-date-row">
			<DatePopover
				value=""
				label={t('intentions.date')}
				variant="default"
				onchange={(day) => {
					parentClose();
					repeat(day, Date.now());
				}}
				><span class="repeat-date-trigger"
					>{t('intentions.repeatDate')}<CalendarMonthOutline
						width="16"
						height="16"
						aria-hidden="true"
					/></span
				></DatePopover
			>
		</div>
	</div>
{/snippet}

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
		position: relative;
		min-width: 236px;
		padding: 4px;
	}
	.repeat-back {
		justify-content: flex-start !important;
		color: var(--cg-text-muted) !important;
	}
	.repeat-date-trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
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
	.repeat-separator {
		border-top: 1px solid var(--cg-border-default);
		margin: 4px 8px;
	}
	.repeat-date-trigger {
		width: 100%;
		justify-content: space-between;
	}
	.repeat-date-row :global(button) {
		border: 0;
		border-radius: var(--cg-radius-control);
		background: transparent;
		display: flex;
		width: 100%;
		min-height: 32px;
		justify-content: space-between;
		padding: 0 8px;
		font-size: 13px;
		font-weight: 400;
		color: var(--cg-text-primary);
		text-align: left;
		cursor: pointer;
	}
	.repeat-date-row :global(button:hover),
	.repeat-date-row :global(button:focus-visible) {
		background: var(--cg-bg-raised);
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
		.repeat-date-row :global(button) {
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
