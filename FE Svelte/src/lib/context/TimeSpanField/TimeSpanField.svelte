<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import TimePicker from '$lib/ui/TimeInput/TimePicker.svelte';
	import { TimeInputState } from '$lib/ui/TimeInput/TimeInputState.svelte';
	import { getTimeInputHost } from '$lib/ui/TimeInput/host.svelte';
	import { rangeLabel } from '$lib/ui/TimeInput/TimeInput';
	import { selectionOf, spanOf } from './selection';
	import type { TimeSpan } from './types';

	type Props = Readonly<{
		label: string;
		span: TimeSpan;
		/** The span may have an end (a chapter's close); a stage's start takes none. */
		withEnd?: boolean;
		disabled?: boolean;
		testId: string;
		onchange: (span: TimeSpan) => void;
	}>;
	let { label, span, withEnd = false, disabled = false, testId, onchange }: Props = $props();
	const id = $props.id();
	/**
	 * The app's own time input, hosted as the record form hosts it (owner 2026-09-28): while the
	 * time is chosen it takes the whole Context in place of the form, and gives it back on apply.
	 */
	const host = getTimeInputHost();
	let picker = $state<TimeInputState | null>(null);
	const start = (): void => {
		picker = new TimeInputState(selectionOf(span));
		picker.open();
		host?.activate({
			picker,
			header: none,
			overlay: none,
			actions,
			close: () => void finish(false)
		});
	};
	const finish = async (apply: boolean): Promise<void> => {
		if (apply && picker) onchange(spanOf(picker.draft, withEnd));
		if (picker) host?.release(picker);
		picker = null;
		await tick();
		document.getElementById(`${id}-trigger`)?.focus();
	};
	onDestroy(() => {
		if (picker) host?.release(picker);
	});
</script>

{#snippet none()}{/snippet}

{#snippet actions()}
	<footer class="picker-footer" data-testid="{testId}-actions">
		<button type="button" onclick={() => void finish(false)}>{t('common.cancel')}</button>
		<button
			type="button"
			class="picker-apply"
			data-testid="{testId}-apply"
			onclick={() => void finish(true)}>{t('time.apply')}</button
		>
	</footer>
{/snippet}

<div
	class={['span-field grid gap-1 text-sm', picker && 'editing', host && 'hosted']}
	data-testid={testId}
>
	{#if picker}
		<div class="span-editor">
			<TimePicker
				{picker}
				onfinish={(apply) => void finish(apply)}
				ondetail={(detail) => picker?.setDetail(detail)}
				{actions}
				mobile={Boolean(host?.phone)}
				allowDuration={false}
				allowEnd={withEnd}
				showDetail={false}
			/>
		</div>
	{:else}
		<span>{label}</span>
		<!-- The trigger as the record form draws it: the value on the left, the caret on the right. -->
		<Button
			variant="quiet"
			class="span-trigger w-full"
			id="{id}-trigger"
			data-testid="{testId}-open"
			aria-label={label}
			{disabled}
			onclick={start}
			><span>{rangeLabel(selectionOf(span))}</span><span aria-hidden="true">▾</span></Button
		>
	{/if}
</div>

<style>
	.span-field {
		min-width: 0;
	}
	.span-field :global(.span-trigger) {
		justify-content: space-between;
		text-align: left;
	}
	.span-field.editing {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		height: min(760px, calc(100svh - 100px));
	}
	.span-field.editing.hosted {
		height: 100%;
	}
	.span-editor {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
