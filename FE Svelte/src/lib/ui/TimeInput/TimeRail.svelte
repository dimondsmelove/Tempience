<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import './TimeRail.css';
	import TimeInputRuler from './TimeInputRuler.svelte';
	import { pxAtTime } from '$lib/state/Viewport/math';
	import { addDays, clockLabel, dateLabel, dayAt, ticks } from './TimeInput';
	import { MINUTE } from './constants';
	import { railGestures } from './gestures';
	import type { RailProps } from './types';
	let { picker, overlay = false }: RailProps = $props();
	let width = $state(600);
	const window = $derived(picker.viewport.window);
	const divisions = $derived(ticks(window, width, picker.mode));
	const coordinate = (t: number) => (picker.mode === 'day' ? dayAt(t) : t);
	const x = (t: number) => pxAtTime(window, coordinate(t), 100);
	const visible = (t: number) => x(t) >= 0 && x(t) <= 100;
	const start = $derived(x(picker.draft.start));
	const end = $derived(picker.draft.end === null ? start : x(picker.draft.end));
	const label = (t: number) => (picker.mode === 'day' ? dateLabel(t) : clockLabel(t));
	function keyboard(event: KeyboardEvent, edge: 'start' | 'end') {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const direction = event.key === 'ArrowRight' ? 1 : -1;
		const value = edge === 'end' ? (picker.draft.end ?? picker.draft.start) : picker.draft.start;
		picker.pick(
			picker.mode === 'day'
				? addDays(value, direction)
				: value + direction * MINUTE * (event.shiftKey ? 15 : 1),
			edge
		);
	}
</script>

<div
	class={['time-input-rail', overlay && 'time-input-overlay', picker.pickingEnd && 'picking-end']}
	role="group"
	aria-label={picker.mode === 'day' ? t('time.dayScale') : t('time.hourScale')}
	data-testid="time-input-rail"
	data-mode={picker.mode}
	data-picking-end={picker.pickingEnd}
	data-window-start={window.start}
	data-window-end={window.end}
	{@attach (element) => {
		const resize = () => {
			width = element.clientWidth;
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(element);
		return () => observer.disconnect();
	}}
	{@attach (element) => railGestures(element, picker)}
>
	{#if !overlay}<TimeInputRuler {picker} direct={false} />{:else}
		{#each divisions.filter((tick) => tick.major) as tick (tick.value)}
			<div class="input-guide" style:left={`${pxAtTime(window, tick.value, 100)}%`}></div>
		{/each}
	{/if}

	{#if !picker.draft.date && picker.draft.end !== null && end >= 0 && start <= 100 && end - start > 1}
		<button
			class={['input-range', picker.draft.window && 'input-window']}
			data-drag="move"
			aria-label={picker.draft.window ? t('time.moveWindow') : t('time.movePeriod')}
			style:left={`${Math.max(0, start)}%`}
			style:width={`${Math.min(100, end) - Math.max(0, start)}%`}
			onkeydown={(event) => {
				if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
				event.preventDefault();
				const dir = event.key === 'ArrowRight' ? 1 : -1;
				picker.translate(
					picker.mode === 'day'
						? addDays(picker.draft.start, dir)
						: picker.draft.start + dir * MINUTE
				);
			}}><span>↔</span></button
		>
	{/if}
	{#each ['start', 'end'] as edge (edge)}
		{@const value = edge === 'end' ? picker.draft.end : picker.draft.start}
		{#if !picker.draft.date && value !== null && visible(value)}
			<button
				class={['input-handle', picker.edge === edge && 'active', edge === 'end' && 'end']}
				data-drag={edge}
				data-testid={`handle-${edge}`}
				style:left={`${x(value)}%`}
				aria-label={`${picker.draft.window ? (edge === 'end' ? t('time.notAfter') : t('time.notBefore')) : edge === 'end' ? t('time.end') : t('time.start')}: ${label(value)}`}
				onclick={(event) => {
					if (event.detail === 0) {
						picker.edge = edge === 'end' ? 'end' : 'start';
						picker.pickingEnd = false;
					}
				}}
				onkeydown={(event) => keyboard(event, edge === 'end' ? 'end' : 'start')}
			>
				<span class="input-pin"></span>
				{#if picker.edge === edge}<span class="input-value">{label(value)}</span>{/if}
			</button>
		{/if}
	{/each}
	{#if !picker.draft.date && !picker.draft.window && !picker.draft.ongoing && picker.detail === 'clock' && picker.draft.end === null && visible(picker.draft.start)}
		<button
			class={['input-extend', picker.pickingEnd && 'armed']}
			style:left={`${Math.max(0, Math.min(width - 48, pxAtTime(window, coordinate(picker.draft.start), width) + 12))}px`}
			data-drag="extend"
			data-testid="extend-end"
			aria-label={t('time.extend')}
			aria-pressed={picker.pickingEnd}
			onclick={(event) => {
				if (event.detail === 0) picker.beginEnd();
			}}
			onkeydown={(event) => keyboard(event, 'end')}
		>
			<span class="extend-line"></span><span class="extend-grip">›</span>
			<span class="extend-tip">{t('time.dragOrTap')}</span>
		</button>
	{/if}
	<div class="input-rail-hint" role="status">
		{picker.pickingEnd && picker.draft.window
			? t('time.pickLateStart')
			: picker.pickingEnd
				? t('time.pickEndKeepStart')
				: picker.mode === 'day'
					? t('time.pickDay')
					: t('time.pickTimeInDay')}
	</div>
</div>
