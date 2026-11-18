<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import type { ButtonVariant } from '$lib/ui/Button/types';
	import { Temporal } from 'temporal-polyfill';
	import { dateTimeFormat } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import DateCalendar from '$lib/ui/DateInput/DateCalendar.svelte';
	import { calendarDate } from '$lib/ui/DateInput/DateInput';
	import Button from '$lib/ui/Button/Button.svelte';
	import MobileSheet from '$lib/ui/MobileSheet/MobileSheet.svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import ClockWheel from '$lib/ui/TimeInput/ClockWheel.svelte';
	import { whenView } from '../WhenModel/WhenModel';
	import type { WhenChoice, WhenContext, WhenTrace } from '../WhenModel/types';
	import {
		activeWhenQuickPick,
		dayKeyInZone,
		whenChoiceForDay,
		whenChoiceForQuickPick
	} from './selection';
	let {
		trace,
		label,
		children: content,
		variant,
		zone,
		now,
		weekStart,
		onpick,
		disabled = false
	}: {
		trace: WhenTrace;
		label?: string;
		children?: Snippet;
		variant?: ButtonVariant;
		zone: string;
		now: number;
		weekStart: number;
		onpick: (choice: WhenChoice) => void;
		disabled?: boolean;
	} = $props();
	const id = $props.id();
	let width = $state(1024);
	let sheetOpen = $state(false);
	let popoverOpen = $state(false);
	let activeZone = $state<'calendar' | 'time'>('calendar');
	let draftTime = $state<{ hours: number; minutes: number } | null>(null);
	/** Only a wheel the user turned commits on dismiss; opening the wheels alone writes nothing. */
	let draftTouched = false;
	let panelElement = $state<HTMLElement>();
	let skipDismissCommit = false;
	const activeTrace = $derived(trace);
	const context = $derived<WhenContext>({ zone, now, weekStart });
	const view = $derived(whenView(activeTrace, context));
	const selectedDay = $derived(view.dayKey ? calendarDate(view.dayKey) : undefined);
	const isMobile = $derived(width <= 800);
	const todayKey = $derived(dayKeyInZone(now, zone));
	const activeQuickPick = $derived(activeWhenQuickPick(view, todayKey, weekStart, zone));
	const selectedClockLabel = $derived(
		view.time
			? `${String(draftTime?.hours ?? view.time.hours).padStart(2, '0')}:${String(draftTime?.minutes ?? view.time.minutes).padStart(2, '0')}`
			: t('intentions.whenNoTime')
	);
	const disabledTimeHint = $derived(t('intentions.needs_day'));
	const clearTimeHint = $derived(
		activeTrace.aboutTime?.basis === 'absolute' && activeTrace.aboutTime.end
			? t('intentions.needs_full')
			: t('intentions.needs_day')
	);
	const shownTime = $derived(draftTime ?? view.time ?? { hours: 9, minutes: 0 });
	const dummyTime = $derived(new Date(2000, 0, 1, shownTime.hours, shownTime.minutes).getTime());
	const selectedLabel = $derived(
		selectedDay
			? dateTimeFormat(locale.current, { dateStyle: 'medium' }).format(selectedDay)
			: t('intentions.date')
	);
	function resetDraft() {
		draftTime = null;
		draftTouched = false;
		activeZone = 'calendar';
	}
	function openSheet() {
		skipDismissCommit = false;
		resetDraft();
		sheetOpen = true;
	}
	function openPopover() {
		skipDismissCommit = false;
		resetDraft();
	}
	/** The control that held focus is replaced, and a card hides its actions once focus leaves it. */
	async function focusInside(selector: string) {
		await tick();
		panelElement?.querySelector<HTMLElement>(selector)?.focus();
	}
	function backToCalendar() {
		activeZone = 'calendar';
		focusInside('.time-entry');
	}
	function openTimeZone() {
		if (!view.canSetTime) return;
		const zonedTime = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(zone);
		draftTime = view.time ?? { hours: zonedTime.hour, minutes: zonedTime.minute };
		activeZone = 'time';
		focusInside('[role="listbox"], .back-to-day');
	}
	function dismiss() {
		if (skipDismissCommit) {
			skipDismissCommit = false;
		} else if (draftTime && draftTouched) {
			onpick({ kind: 'time', ...draftTime });
		}
		resetDraft();
		sheetOpen = false;
		popoverOpen = false;
	}
	function choose(choice: WhenChoice, close?: () => void) {
		skipDismissCommit = true;
		resetDraft();
		onpick(choice);
		if (isMobile) {
			skipDismissCommit = false;
			sheetOpen = false;
		} else close?.();
	}
	function done(close?: () => void) {
		if (draftTime) onpick({ kind: 'time', ...draftTime });
		skipDismissCommit = true;
		resetDraft();
		if (isMobile) {
			skipDismissCommit = false;
			sheetOpen = false;
		} else close?.();
	}
	function clearTime(close?: () => void) {
		if (!view.canClearTime) return;
		skipDismissCommit = true;
		resetDraft();
		onpick({ kind: 'clearTime' });
		if (isMobile) {
			skipDismissCommit = false;
			sheetOpen = false;
		} else close?.();
	}
	function selectDay(date: Date, close?: () => void) {
		choose(whenChoiceForDay(date), close);
	}
</script>

<svelte:window bind:innerWidth={width} />

{#snippet trigger()}
	{#if content}{@render content()}{:else}<span aria-hidden="true">▦</span>{/if}
{/snippet}

{#snippet panel(close?: () => void)}
	<div
		class="when-panel"
		data-testid="when-panel"
		bind:this={panelElement}
		data-when-placement={view.placement}
		role={isMobile ? 'group' : 'dialog'}
		aria-label={t('intentions.whenLabel')}
	>
		<div class="quick-picks" aria-label={t('intentions.date')}>
			<button
				type="button"
				aria-pressed={activeQuickPick === 'today'}
				onclick={() => choose(whenChoiceForQuickPick('today'), close)}
			>
				{t('intentions.whenToday')}
			</button>
			<button
				type="button"
				aria-pressed={activeQuickPick === 'tomorrow'}
				onclick={() => choose(whenChoiceForQuickPick('tomorrow'), close)}
			>
				{t('intentions.whenTomorrow')}
			</button>
			<button
				type="button"
				aria-pressed={activeQuickPick === 'week'}
				onclick={() => choose(whenChoiceForQuickPick('week'), close)}
			>
				{t('intentions.whenWeek')}
			</button>
			<button
				type="button"
				aria-pressed={activeQuickPick === 'undated'}
				onclick={() => choose(whenChoiceForQuickPick('undated'), close)}
			>
				{t('intentions.whenUndated')}
			</button>
		</div>

		{#if activeZone === 'time'}
			<div class="calendar-heading time-heading">
				<button type="button" class="back-to-day" onclick={backToCalendar}>← {selectedLabel}</button
				>
				<button
					type="button"
					class="clear-time"
					disabled={!view.canClearTime}
					title={!view.canClearTime ? clearTimeHint : undefined}
					onclick={() => clearTime(close)}>{t('intentions.whenNoTime')}</button
				>
			</div>
		{/if}

		<div class="selection-zone">
			{#if activeZone === 'calendar'}
				<DateCalendar
					value={selectedDay}
					{todayKey}
					dayButtonClass={isMobile ? 'h-11 min-h-11 p-0' : 'h-8 min-h-8 p-0'}
					onselect={(date) => selectDay(date, close)}
				/>
			{:else if view.canSetTime}
				<ClockWheel
					value={dummyTime}
					onchange={(hours, minutes) => {
						draftTime = { hours, minutes };
						draftTouched = true;
					}}
				/>
			{/if}
		</div>

		<div class="time-section">
			{#if activeZone === 'calendar'}
				<div class="time-actions start">
					<button
						type="button"
						class="time-entry"
						disabled={!view.canSetTime}
						title={!view.canSetTime ? disabledTimeHint : undefined}
						onclick={openTimeZone}>{t('time.setTime')}</button
					>
					<span class="current-time">{selectedClockLabel}</span>
					{#if !view.canSetTime && view.canClearTime}
						<button type="button" class="clear-time" onclick={() => clearTime(close)}
							>{t('intentions.whenNoTime')}</button
						>
					{/if}
				</div>
			{:else}
				<div class="time-actions">
					<span
						>{selectedLabel} · {String(shownTime.hours).padStart(2, '0')}:{String(
							shownTime.minutes
						).padStart(2, '0')}</span
					>
					<button type="button" class="done" onclick={() => done(close)}>{t('time.done')}</button>
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#if isMobile}
	<Button
		size="sm"
		variant={variant ?? 'quiet'}
		class="when-trigger"
		aria-label={label ?? t('intentions.date')}
		aria-haspopup="dialog"
		aria-expanded={sheetOpen}
		{disabled}
		onclick={openSheet}>{@render trigger()}</Button
	>
	{#if sheetOpen}
		<MobileSheet label={t('intentions.whenLabel')} onclose={dismiss}>
			{@render panel()}
		</MobileSheet>
	{/if}
{:else}
	<Popover
		id={`${id}-when`}
		label={label ?? t('intentions.date')}
		icon={!content}
		{variant}
		{disabled}
		pressed={popoverOpen}
		ontoggle={(open) => {
			popoverOpen = open;
			if (open) openPopover();
			else dismiss();
		}}
		{trigger}
		children={panel}
	/>
{/if}

<style>
	.when-panel {
		width: min(20rem, calc(100vw - 2rem));
		max-width: 100%;
		padding: 0.75rem;
		display: grid;
		gap: 0.875rem;
		color: var(--cg-text-primary);
	}
	.quick-picks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.quick-picks button,
	.time-actions button {
		min-height: 2rem;
		border: 1px solid var(--cg-border-outline);
		border-radius: var(--cg-radius-control, 0.5rem);
		background: var(--cg-bg-surface);
		color: var(--cg-text-primary);
		padding: 0.5rem 0.75rem;
		font: inherit;
	}
	.quick-picks button:hover:not(:disabled),
	.time-actions button:hover:not(:disabled) {
		background: var(--cg-bg-raised);
	}
	.quick-picks button[aria-pressed='true'] {
		border-color: var(--cg-accent);
		box-shadow: inset 0 0 0 1px var(--cg-accent);
	}
	.quick-picks button {
		flex: 1 1 auto;
		white-space: nowrap;
		padding: 0.25rem 0.5rem;
		font-size: 0.8125rem;
	}
	.calendar-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.375rem;
		font-weight: 600;
	}
	.time-section {
		border-top: 1px solid var(--cg-border-outline);
		padding-top: 0.625rem;
		display: grid;
		gap: 0.625rem;
	}
	.time-actions button {
		min-height: 2rem;
		border: 1px solid var(--cg-border-outline);
		border-radius: var(--cg-radius-control, 0.5rem);
		background: var(--cg-bg-surface);
		color: var(--cg-text-primary);
		padding: 0.5rem 0.75rem;
		font: inherit;
	}
	.time-actions button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.selection-zone {
		min-height: 17rem;
		display: grid;
		align-items: start;
		align-content: start;
	}
	.time-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.time-actions.start {
		justify-content: flex-start;
	}
	.current-time {
		color: var(--cg-text-muted);
		font-size: 0.8125rem;
	}
	.time-actions .done {
		background: var(--cg-accent);
		color: var(--cg-text-on-accent);
		border-color: var(--cg-accent);
	}
	:global(.when-panel .clock-wheels) {
		justify-content: center;
	}
	@media (max-width: 800px) {
		.when-panel {
			width: 100%;
			padding: 0.875rem 1rem calc(1rem + env(safe-area-inset-bottom));
			gap: 1rem;
		}
		.quick-picks button,
		.time-actions button {
			min-height: 2.75rem;
		}
		.quick-picks button {
			font-size: 0.875rem;
		}
		.selection-zone {
			min-height: 21rem;
		}
	}
</style>
