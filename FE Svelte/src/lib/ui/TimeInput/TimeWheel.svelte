<script lang="ts">
	import { tick } from 'svelte';
	import { WHEEL_ROW_PX } from './constants';
	import type { WheelProps } from './types';
	let {
		label,
		options,
		value,
		onchange,
		numeric = false,
		numericDigits = 2,
		onnumber,
		compact = false,
		list = false
	}: WheelProps = $props();
	let digits = '';
	let keyboardSelecting = false;
	let typedAt = 0;
	let wheelRemainder = 0;
	let wheelAt = 0;
	function select(element: HTMLElement, index: number) {
		const option = options[index];
		if (!option || option.disabled) return;
		element.scrollTo({
			top: Math.max(0, index - (list ? 2 : 0)) * WHEEL_ROW_PX,
			behavior: 'instant'
		});
		onchange(option.value);
	}
	async function keyboard(event: KeyboardEvent, index: number) {
		const column = (event.currentTarget as HTMLElement).parentElement!;
		let next = index;
		const step = event.key === 'ArrowUp' || event.key === 'PageUp' ? -1 : 1;
		if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key)) {
			next += step * (event.key.startsWith('Page') ? 5 : 1);
		} else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = options.length - 1;
		else if (
			numeric &&
			/^\d$/.test(event.key) &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey
		) {
			const now = Date.now();
			digits =
				now - typedAt < 900 && digits.length < numericDigits ? digits + event.key : event.key;
			typedAt = now;
			next = options.findIndex((option) => option.value === Number(digits));
			if (next < 0) {
				if (onnumber) {
					event.preventDefault();
					event.stopPropagation();
					keyboardSelecting = true;
					onnumber(Number(digits));
					await tick();
					(column.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus({
						preventScroll: true
					});
					keyboardSelecting = false;
				}
				return;
			}
		} else return;
		event.preventDefault();
		event.stopPropagation();
		next = Math.max(0, Math.min(options.length - 1, next));
		while (options[next]?.disabled && next >= 0 && next < options.length) next += step;
		if (!options[next]) return;
		keyboardSelecting = true;
		select(column, next);
		await tick();
		(column.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus({
			preventScroll: true
		});
		keyboardSelecting = false;
	}
	function connect(element: HTMLElement) {
		const selected = Math.max(
			0,
			options.findIndex((option) => option.value === value)
		);
		let engaged = false;
		let pressed = false;
		let timer: ReturnType<typeof setTimeout>;
		const align = () => {
			// Popover children can mount before they have scroll geometry.
			if (element.clientHeight)
				element.scrollTop = Math.max(0, selected - (list ? 2 : 0)) * WHEEL_ROW_PX;
		};
		const commit = () => {
			if (!engaged || pressed || !element.clientHeight) return;
			const index = Math.max(
				0,
				Math.min(options.length - 1, Math.round(element.scrollTop / WHEEL_ROW_PX))
			);
			engaged = false;
			if (options[index].disabled) align();
			else select(element, index);
		};
		const scroll = () => {
			clearTimeout(timer);
			if (engaged) timer = setTimeout(commit, 150);
		};
		const start = () => {
			engaged = true;
			pressed = true;
		};
		const end = () => {
			pressed = false;
			scroll();
		};
		const cancel = () => {
			engaged = false;
			pressed = false;
			clearTimeout(timer);
			align();
		};
		const wheel = (event: WheelEvent) => {
			if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
			event.preventDefault();
			event.stopPropagation();
			engaged = false;
			clearTimeout(timer);
			const now = Date.now();
			if (now - wheelAt > 180 || Math.sign(wheelRemainder) !== Math.sign(event.deltaY))
				wheelRemainder = 0;
			wheelAt = now;
			// Small trackpad deltas accumulate; a mouse notch never skips several values.
			if (event.deltaMode === 0 && Math.abs(event.deltaY) < WHEEL_ROW_PX) {
				wheelRemainder += event.deltaY;
				if (Math.abs(wheelRemainder) < WHEEL_ROW_PX) return;
				wheelRemainder -= Math.sign(event.deltaY) * WHEEL_ROW_PX;
			} else wheelRemainder = 0;
			const index = Math.round(element.scrollTop / WHEEL_ROW_PX) + Math.sign(event.deltaY);
			select(element, Math.max(0, Math.min(options.length - 1, index)));
		};
		align();
		const observer = new ResizeObserver(align);
		observer.observe(element);
		if (list) return () => observer.disconnect();
		element.addEventListener('scroll', scroll);
		element.addEventListener('wheel', wheel, { passive: false });
		element.addEventListener('touchstart', start, { passive: true });
		element.addEventListener('touchend', end);
		element.addEventListener('touchcancel', cancel);
		return () => {
			observer.disconnect();
			clearTimeout(timer);
			element.removeEventListener('scroll', scroll);
			element.removeEventListener('wheel', wheel);
			element.removeEventListener('touchstart', start);
			element.removeEventListener('touchend', end);
			element.removeEventListener('touchcancel', cancel);
		};
	}
</script>

<div class={['time-wheel', compact && 'compact-wheel', list && 'time-list']}>
	<span class="wheel-label">{label}</span>
	<div class="wheel-frame">
		<div class="wheel-focus"></div>
		<div
			class="wheel-list"
			role="listbox"
			aria-label={label}
			{@attach connect}
			onfocusout={(event) => {
				if (
					!keyboardSelecting &&
					!(
						event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)
					)
				) {
					digits = '';
					typedAt = 0;
				}
			}}
		>
			{#each options as option, index (option.value)}
				<button
					type="button"
					role="option"
					aria-label={`${label}: ${option.label}`}
					aria-selected={option.value === value}
					aria-disabled={option.disabled || undefined}
					tabindex={option.value === value ? 0 : -1}
					onclick={(event) => select(event.currentTarget.parentElement!, index)}
					onkeydown={(event) => keyboard(event, index)}>{option.label}</button
				>
			{/each}
		</div>
	</div>
</div>
