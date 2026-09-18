<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { pxAtTime } from '$lib/state/Viewport/math';
	import { clockLabel, dateLabel, dayWindow, ticks } from './TimeInput';
	import type { TimeInputState } from './TimeInputState.svelte';
	let { picker, direct = true }: { picker: TimeInputState; direct?: boolean } = $props();
	let width = $state(600);
	const window = $derived(picker.viewport.window);
	const divisions = $derived(ticks(window, width, picker.mode));
</script>

<div
	class="input-ruler"
	aria-label={picker.mode === 'day' ? t('time.dayTicks') : t('time.hourTicks')}
	{@attach (element) => {
		const resize = () => {
			width = element.clientWidth;
		};
		resize();
		const observer = new ResizeObserver(resize);
		observer.observe(element);
		return () => observer.disconnect();
	}}
>
	<div class="input-baseline"></div>
	{#each divisions as tick (tick.value)}
		<div
			class={['input-tick', tick.major && 'major']}
			style:left={`${pxAtTime(window, tick.value, 100)}%`}
		>
			{#if tick.label}
				<button
					class="input-tick-label"
					disabled={picker.mode === 'minute' && tick.value >= dayWindow(picker.point).end}
					style:transform={pxAtTime(window, tick.value, width) < 22
						? 'translateX(0)'
						: pxAtTime(window, tick.value, width) > width - 22
							? 'translateX(-100%)'
							: undefined}
					style:visibility={pxAtTime(window, tick.value, width) < -1 ||
					pxAtTime(window, tick.value, width) > width + 1
						? 'hidden'
						: 'visible'}
					aria-label={t('time.pick', {
						value: picker.mode === 'day' ? dateLabel(tick.value) : clockLabel(tick.value)
					})}
					onclick={(event) => {
						if (direct || event.detail === 0) picker.pick(tick.value);
					}}
				>
					<small>{tick.detail || ' '}</small>{tick.label}
				</button>
			{/if}
		</div>
	{/each}
</div>
