<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { on } from 'svelte/events';
	import Button from '$lib/ui/Button/Button.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import TimePicker from '$lib/ui/TimeInput/TimePicker.svelte';
	import TimeRail from '$lib/ui/TimeInput/TimeRail.svelte';
	import TimeInputControls from '$lib/ui/TimeInput/TimeInputControls.svelte';
	import TimeInputRuler from '$lib/ui/TimeInput/TimeInputRuler.svelte';
	import { TimeInputState } from '$lib/ui/TimeInput/TimeInputState.svelte';
	import { getTimeInputHost } from '$lib/ui/TimeInput/host.svelte';
	import { amountLabel, measuredDuration } from '$lib/ui/TimeInput/duration';
	import type { TimeSelection } from '$lib/ui/TimeInput/types';
	import type { TimeDraft, TemporalPlacement } from './types';
	import { initialTime, temporalPlacement } from './time';
	import { selectionFromPlacement, placementFromSelection, sameSelection } from './selection';
	import TimeEvidence from './TimeEvidence.svelte';
	let {
		draft = $bindable(),
		open = $bindable(false),
		existing
	}: {
		draft: TimeDraft;
		open?: boolean;
		existing?: TemporalPlacement;
	} = $props();
	const id = $props.id();
	const host = getTimeInputHost();
	let picker = $state<TimeInputState | null>(null);
	let original = $state.raw<TemporalPlacement | null>(null);
	let initial = $state.raw<TimeSelection | null>(null);
	const current = $derived(read(() => temporalPlacement(draft, existing)));
	const preview = $derived(
		read(() =>
			picker && original && initial
				? sameSelection(picker.draft, initial)
					? original
					: placementFromSelection(picker.draft, original)
				: current.value!
		)
	);
	const applyLabel = $derived(
		picker?.durationNotice
			? measuredDuration(picker.draft)
				? t('time.applyAmount', { amount: amountLabel(measuredDuration(picker.draft)!) })
				: t('time.noDuration')
			: picker?.pickingEnd
				? picker.draft.window
					? t('time.noLateDate')
					: t('time.keepNoEnd')
				: t('time.apply')
	);
	/** A placement that cannot be read keeps its cause; the words are the language's. */
	function read(get: () => TemporalPlacement) {
		try {
			return { value: get(), error: null as unknown };
		} catch (error) {
			return { value: null, error: error ?? new Error() };
		}
	}
	function start() {
		if (!current.value) return;
		original = current.value;
		initial = selectionFromPlacement(original);
		picker = new TimeInputState(initial);
		picker.open();
		open = true;
		host?.activate({
			picker,
			header: inputHeader,
			overlay: inputOverlay,
			actions,
			close: () => void finish(false)
		});
	}
	async function finish(apply: boolean) {
		if (apply && preview.error) return;
		if (apply && picker && initial && preview.value && !sameSelection(picker.draft, initial))
			draft = { mode: 'chosen', chosen: preview.value };
		if (picker) host?.release(picker);
		picker = null;
		open = false;
		await tick();
		document.getElementById(`${id}-trigger`)?.focus();
	}
	function switchInput() {
		if (!picker) return;
		const next = picker.input === 'picker' ? 'timeline' : 'picker';
		if (host) host.switchInput(next);
		else picker.switchInput(next);
	}
	function reset() {
		draft = initialTime(existing);
		void finish(false);
	}
	onDestroy(() => {
		if (picker) host?.release(picker);
	});
</script>

{#snippet actions()}
	<div
		class={[host?.phone && 'time-mobile-actions']}
		data-testid={host?.phone ? 'mobile-actions' : undefined}
	>
		<footer class="picker-footer" data-testid="time-actions">
			<button
				type="button"
				data-testid={picker?.input === 'timeline' ? 'choose-picker' : 'choose-timeline'}
				onclick={switchInput}
				>{picker?.input === 'timeline' ? t('time.wheels') : t('time.onScale')}</button
			>
			<button type="button" aria-label={t('time.cancelChange')} onclick={() => finish(false)}
				>{t('common.cancel')}</button
			>
			<button
				type="button"
				class="picker-apply"
				disabled={Boolean(preview.error)}
				onclick={() => finish(true)}>{applyLabel}</button
			>
		</footer>
	</div>
{/snippet}
{#snippet inputHeader()}{#if picker}<TimeInputControls {picker} boundaries={false} /><TimeInputRuler
			{picker}
		/>{/if}{/snippet}
{#snippet inputOverlay()}{#if picker}<TimeRail {picker} overlay />{/if}{/snippet}
{#snippet standaloneTimeline()}{#if picker}<TimeInputControls
			{picker}
			boundaries={false}
		/><TimeRail {picker} />{/if}{/snippet}
{#snippet resets()}
	{#if existing}<button type="button" onclick={reset}>{t('time.restore')}</button>{/if}
{/snippet}
{#snippet extras()}
	{#if picker}<TimeEvidence {picker} {resets} />{/if}
	{#if preview.error !== null}<p role="alert">{errorText(preview.error)}</p>{/if}
{/snippet}

<div class={['time-fields', open && 'editing', host && 'hosted']} aria-label={t('time.recordTime')}>
	{#if !open}
		<Button
			variant="quiet"
			class="time-trigger w-full"
			id={`${id}-trigger`}
			data-testid="trace-time"
			aria-expanded={false}
			onclick={start}
		>
			<span
				>{t('time.whenIs', {
					value: current.value ? traceTimeLabel(current.value, locale.current) : t('time.refine')
				})}</span
			><span aria-hidden="true">▾</span>
		</Button>
		{#if current.error !== null}<p role="alert">{errorText(current.error)}</p>{/if}
	{:else if picker}
		<div
			class={[
				'trace-time-editor',
				host?.phone && 'phone-time-editor',
				picker.input === 'timeline' && 'on-scale'
			]}
			data-testid="trace-time-editor"
			{@attach (element) =>
				on(element, 'keydown', (event) => {
					if (event.key !== 'Escape' || (event.target as Element).closest('[popover]')) return;
					event.preventDefault();
					event.stopPropagation();
					if (picker?.calendar) picker.calendar = false;
					else if (picker?.pickingEnd) picker.cancelEnd();
					else void finish(false);
				})}
		>
			{#if picker.draft.date === 'preserved' && original}<p class="original-placement">
					{traceTimeLabel(original, locale.current)}
				</p>{/if}
			<TimePicker
				{picker}
				onfinish={finish}
				ondetail={(detail) => {
					picker!.setDetail(detail);
					if (host) host.switchInput('picker');
					else picker!.switchInput('picker');
				}}
				{actions}
				{extras}
				mobile={Boolean(host?.phone)}
				timeline={host ? undefined : standaloneTimeline}
				allowDuration={original?.aboutKind !== 'trace_ref' || picker.draft.date !== 'preserved'}
			/>
		</div>
	{/if}
</div>

<style>
	.time-mobile-actions {
		grid-column: 1 / -1;
		position: relative;
		z-index: 45;
		background: var(--cg-bg-surface);
	}
	.time-mobile-actions :global(.picker-footer) {
		padding-bottom: calc(8px + env(safe-area-inset-bottom));
	}
	.time-fields {
		min-width: 0;
	}
	.time-fields :global(.time-trigger) {
		justify-content: space-between;
		text-align: left;
	}
	.time-fields.editing {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		height: min(760px, calc(100svh - 100px));
	}
	.time-fields.editing.hosted {
		height: 100%;
	}
	.trace-time-editor {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	.phone-time-editor :global(.time-picker) {
		border-radius: 0;
	}
	.phone-time-editor.on-scale :global(.picker-heading) {
		display: none;
	}
	.phone-time-editor.on-scale :global(.picker-boundaries) {
		padding-top: 4px;
	}
	.phone-time-editor.on-scale :global(.picker-on-scale) {
		overflow-y: auto;
	}
	.original-placement {
		padding: 8px;
		font-size: 12px;
		color: var(--cg-text-muted);
	}
</style>
