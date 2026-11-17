<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { DayTrace } from './types';
	let { traces, open }: { traces: readonly DayTrace[]; open: (id: string) => void } = $props();
	const dateLabel = (day: string) => {
		const parts = new Intl.DateTimeFormat(locale.current, {
			weekday: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		}).formatToParts(new Date(`${day}T12:00:00Z`));
		return [
			parts.find((part) => part.type === 'weekday')?.value,
			parts.find((part) => part.type === 'day')?.value
		]
			.filter(Boolean)
			.join(' ');
	};
</script>

{#if traces.length}
	<div class="heading"><span>{t('intentions.traces')}</span><span class="line"></span></div>
	{#each traces as trace (JSON.stringify([trace.factId, trace.taskId]))}
		<button class="trace" data-testid="intention-trace" onclick={() => open(trace.taskId)}>
			<span class="icon"
				><svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"
					><path
						d="M5 11l6-6M6.5 5H11v4.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				></span
			>
			<span class="text"
				>{trace.text}<br /><span class="task"
					>{trace.taskTitle} <span class="date">· {dateLabel(trace.taskDay)}</span></span
				></span
			>
		</button>
	{/each}
{/if}

<style>
	.heading {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 10px 6px 2px;
		color: var(--cg-text-muted);
		font-size: 11px;
		letter-spacing: 0.04em;
	}
	.line {
		flex: 1;
		height: 1px;
		background: var(--cg-border-default);
	}
	.trace {
		box-sizing: border-box;
		width: 100%;
		display: grid;
		grid-template-columns: 12px minmax(0, 1fr);
		column-gap: 6px;
		padding: 3px 6px;
		border: 0;
		border-radius: 3px;
		background: transparent;
		color: var(--cg-text-muted);
		font: inherit;
		font-size: 12px;
		line-height: 16px;
		text-align: left;
		cursor: pointer;
	}
	.icon {
		height: 16px;
		display: flex;
		align-items: center;
	}
	.text {
		min-width: 0;
		overflow-wrap: anywhere;
		white-space: pre-line;
	}
	.task {
		opacity: 0.85;
	}
	.date {
		font-family: var(--cg-font-mono);
		white-space: nowrap;
	}
</style>
