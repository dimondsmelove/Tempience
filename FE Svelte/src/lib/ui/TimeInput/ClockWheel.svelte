<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import './ClockWheel.css';
	import TimeWheel from './TimeWheel.svelte';
	import { HOURS, MINUTES } from './constants';
	let {
		value,
		onchange,
		onclear
	}: {
		value: number | null;
		onchange: (hours: number, minutes: number) => void;
		onclear?: () => void;
	} = $props();
	const hours = $derived(value === null ? null : new Date(value).getHours());
	const minutes = $derived(value === null ? null : new Date(value).getMinutes());
	const hoursOptions = $derived([
		...(onclear ? [{ value: null, label: '—' }] : []),
		...HOURS.map((value) => ({ value, label: String(value).padStart(2, '0') }))
	]);
	const minutesOptions = $derived([
		...(onclear ? [{ value: null, label: '—' }] : []),
		...MINUTES.map((value) => ({ value, label: String(value).padStart(2, '0') }))
	]);
</script>

<div class="clock-wheels">
	<TimeWheel
		label={t('time.hours')}
		options={hoursOptions}
		value={hours}
		numeric
		onchange={(hour) => (hour === null ? onclear?.() : onchange(hour, minutes ?? 0))}
	/>
	<TimeWheel
		label={t('time.minutes')}
		options={minutesOptions}
		value={minutes}
		numeric
		onchange={(minute) => (minute === null ? onclear?.() : onchange(hours ?? 0, minute))}
	/>
</div>
