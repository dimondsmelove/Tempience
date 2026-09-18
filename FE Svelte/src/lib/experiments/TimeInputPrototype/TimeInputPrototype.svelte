<script lang="ts">
	import '$lib/theme/appearance.css';
	import './TimeInputPrototype.css';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { ensureActiveScenarioSeed } from '$lib/scenarios';
	import AppShell from '$lib/shell/AppShell/AppShell.svelte';
	import Workbench from '$lib/time/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import TimeRail from '$lib/ui/TimeInput/TimeRail.svelte';
	import TimeInputRuler from '$lib/ui/TimeInput/TimeInputRuler.svelte';
	import TimeInputControls from '$lib/ui/TimeInput/TimeInputControls.svelte';
	import TimePicker from '$lib/ui/TimeInput/TimePicker.svelte';
	import type { SheetPosition } from '$lib/ui/BottomSheet/types';
	import { TimeInputState } from '$lib/ui/TimeInput/TimeInputState.svelte';
	import { amountLabel, measuredDuration } from '$lib/ui/TimeInput/duration';
	import { dayAt, durationLabel, rangeLabel } from '$lib/ui/TimeInput/TimeInput';
	let { standalone = false }: { standalone?: boolean } = $props();
	const picker = new TimeInputState({ start: dayAt(Date.now()), end: null, timed: false });
	let text = $state('Прогулка');
	let completed = $state(false);
	let contextPosition = $state<SheetPosition>('full');
	function switchInput(input: 'picker' | 'timeline') {
		picker.switchInput(input);
		contextPosition = input === 'timeline' ? 'peek' : 'full';
	}
	const applyLabel = $derived(
		picker.durationNotice
			? measuredDuration(picker.draft) === null
				? 'Без длительности'
				: `Применить ${amountLabel(measuredDuration(picker.draft)!)}`
			: picker.pickingEnd
				? 'Оставить без окончания'
				: 'Применить'
	);
	const seeded = $derived(standalone ? Promise.resolve() : ensureActiveScenarioSeed());
	let field: HTMLButtonElement | null = null;
	async function finish(apply: boolean) {
		contextPosition = 'full';
		if (apply) picker.apply();
		else picker.cancel();
		await tick();
		field?.focus({ preventScroll: true });
	}
</script>

<svelte:window
	onkeydowncapture={(event) => {
		if (
			event.key === 'Escape' &&
			picker.active &&
			!document.querySelector('[popover]:popover-open')
		) {
			event.preventDefault();
			event.stopImmediatePropagation();
			if (picker.input === 'picker' && picker.calendar) picker.calendar = false;
			else if (picker.pickingEnd) picker.cancelEnd();
			else void finish(false);
		}
	}}
/>

{#snippet actions()}
	<footer class="picker-footer" data-testid="time-input-actions">
		<button
			type="button"
			data-testid={picker.input === 'timeline' ? 'choose-picker' : 'choose-timeline'}
			onclick={() => switchInput(picker.input === 'timeline' ? 'picker' : 'timeline')}
		>
			{picker.input === 'timeline' ? 'Колёса' : 'На шкале ↗'}
		</button>
		<button type="button" onclick={() => finish(false)}>Отмена</button>
		<button type="button" class="picker-apply" onclick={() => finish(true)}>{applyLabel}</button>
	</footer>
{/snippet}
{#snippet mobileActions()}<div class="prototype-mobile-actions" data-testid="mobile-actions">
		{@render actions()}
	</div>{/snippet}
{#snippet inputHeader()}<TimeInputControls {picker} boundaries={false} /><TimeInputRuler
		{picker}
	/>{/snippet}
{#snippet inputOverlay()}<TimeRail {picker} overlay />{/snippet}
{#snippet standaloneTimeline()}<TimeInputControls {picker} boundaries={false} /><TimeRail
		{picker}
	/>{/snippet}

{#snippet form(phone: boolean)}
	<div
		class={[
			'prototype-form',
			picker.active && 'editing',
			phone && 'phone-form',
			picker.active && picker.input === 'timeline' && 'choosing-on-scale'
		]}
		data-testid="prototype-form"
	>
		<div class="prototype-form-heading">
			<h1>Записать</h1>
			<span>Прототип</span>
		</div>
		<label class="prototype-text"
			>Что произошло?
			<textarea class="cg-field" bind:value={text} rows={picker.active ? 2 : 3}></textarea>
		</label>
		{#if !picker.active}<button
				class="prototype-time-field"
				data-testid="when-field"
				{@attach (element) => {
					field = element;
					return () => {
						field = null;
					};
				}}
				onclick={() => {
					completed = false;
					contextPosition = 'full';
					picker.open(standalone ? undefined : workbench.viewport.window);
				}}
			>
				<small>Когда</small>
				<span>{rangeLabel(picker.value)}</span>
				<span class="field-edit">Изменить ›</span>
			</button>{:else}
			<TimePicker
				{picker}
				onfinish={finish}
				ondetail={(detail) => {
					picker.setDetail(detail);
					switchInput('picker');
				}}
				{actions}
				mobile={phone}
				timeline={standalone ? standaloneTimeline : undefined}
			/>
		{/if}
		{#if !picker.active}
			{#if !picker.value.duration && durationLabel(picker.value)}<p class="text-muted">
					{durationLabel(picker.value)}
				</p>{/if}
			<Button disabled={picker.active || !text.trim()} onclick={() => (completed = true)}
				>Готово</Button
			>
			{#if completed}<p role="status">Черновик: {text} · {rangeLabel(picker.value)}</p>{/if}
			<a
				class="prototype-variant"
				href={resolve(
					standalone ? '/experiments/time-input' : '/experiments/time-input?view=field'
				)}
			>
				{standalone
					? 'Посмотреть выбор на основном таймлайне →'
					: 'Посмотреть поле без таймлайна →'}
			</a>
			<p class="prototype-note">Изменения остаются в этом черновике.</p>
		{/if}
	</div>
{/snippet}

<div
	class={['appearance-shell time-prototype', !standalone && 'prototype-workbench']}
	style={appearance.style}
	data-testid="time-prototype"
	data-start={picker.draft.start}
	data-end={picker.draft.end ?? ''}
	data-timed={picker.draft.timed}
	data-picking={picker.active}
	data-input={picker.input}
	data-detail={picker.detail}
	data-duration={picker.draft.duration?.amount ?? ''}
	data-duration-unit={picker.draft.duration?.unit ?? ''}
>
	{#if standalone}
		<header class="prototype-header">
			<span>Tempience</span><span>Выбор времени · прототип</span>
		</header>
		<main>{@render form(false)}</main>
	{:else}
		<AppShell variant="time">
			{#await seeded then}
				<Workbench
					preview={{
						context: form,
						contextPosition,
						oncontextposition: (position) => (contextPosition = position),
						oncontextclose: () => {
							if (picker.active) void finish(false);
						},
						mobileActions: picker.active ? mobileActions : undefined,
						interaction:
							picker.active && picker.input === 'timeline'
								? {
										viewport: picker.viewport,
										header: inputHeader,
										overlay: inputOverlay
									}
								: undefined
					}}
				/>
			{:catch error}<p role="alert">Не удалось открыть ленту: {String(error)}</p>{/await}
		</AppShell>
	{/if}
</div>
