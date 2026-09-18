<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { LabelBox, MarkBox } from '$lib/model/Labels/types';
	import type { RibbonLayout } from '$lib/model/Layout/types';
	import { TWIN_LIMIT } from './constants';
	import type { SelectSource } from './types';

	type Props = Readonly<{
		layout: RibbonLayout | null;
		selectedTraceId: string | null;
		onselect: (traceId: string, source: SelectSource) => void;
	}>;
	let { layout, selectedTraceId, onselect }: Props = $props();

	type Entry = Readonly<{
		box: MarkBox;
		rowName: string;
		label: LabelBox | null;
		/** No other mark of the row touches this one, so a click on it is unambiguous. */
		alone: boolean;
	}>;
	const touches = (a: MarkBox, b: MarkBox): boolean =>
		a.x0 <= b.x1 + 2 && a.x1 >= b.x0 - 2 && a.y0 <= b.y1 + 2 && a.y1 >= b.y0 - 2;
	const entries = $derived.by((): Entry[] => {
		if (!layout) return [];
		const list: Entry[] = [];
		for (const row of layout.rows) {
			for (const box of row.boxes) {
				if (box.x1 < 0 || box.x0 > layout.widthPx) continue;
				const label = row.labels.find((candidate) => candidate.markId === box.mark.id) ?? null;
				const alone = !row.boxes.some((other) => other !== box && touches(box, other));
				list.push({ box, rowName: row.row.name, label, alone });
			}
		}
		// Proposals need attention first, and must not fall past the limit on wide windows.
		return list.toSorted(
			(a, b) => Number(Boolean(b.box.mark.proposal)) - Number(Boolean(a.box.mark.proposal))
		);
	});
	const centre = (n0: number, n1: number): string => ((n0 + n1) / 2).toFixed(1);
	const shown = $derived(entries.slice(0, TWIN_LIMIT));

	/** Arrow keys move between records; Home and End jump to the ends. */
	const onkeydown = (event: KeyboardEvent): void => {
		const list = (event.currentTarget as HTMLElement).closest('ul');
		if (!list) return;
		const buttons = [...list.querySelectorAll<HTMLButtonElement>('button')];
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		if (index < 0) return;
		const step =
			event.key === 'ArrowDown' || event.key === 'ArrowRight'
				? 1
				: event.key === 'ArrowUp' || event.key === 'ArrowLeft'
					? -1
					: 0;
		const target =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? buttons.length - 1
					: step
						? Math.min(buttons.length - 1, Math.max(0, index + step))
						: -1;
		if (target < 0) return;
		event.preventDefault();
		buttons[target]?.focus();
	};
</script>

<ul class="sr-only" aria-label={t('twin.records')} data-testid="ribbon-twin">
	{#each shown as entry (entry.box.mark.id)}
		<li>
			<button
				type="button"
				data-trace-id={entry.box.mark.traceId}
				data-kind={entry.box.mark.kind}
				data-proposal={entry.box.mark.proposal || undefined}
				data-alone={entry.alone ? 'true' : undefined}
				data-x={centre(entry.box.x0, entry.box.x1)}
				data-y={centre(entry.box.y0, entry.box.y1)}
				data-label-x={entry.label
					? centre(entry.label.x, entry.label.x + entry.label.width)
					: undefined}
				data-label-y={entry.label
					? centre(entry.label.y, entry.label.y + entry.label.height)
					: undefined}
				aria-current={entry.box.mark.traceId === selectedTraceId ? 'true' : undefined}
				onclick={() => onselect(entry.box.mark.traceId, 'twin')}
				{onkeydown}
			>
				{entry.box.mark.label} · {entry.box.mark.timeLabel} · {entry.rowName}{entry.box.mark.intent
					? t('twin.intent')
					: ''}{entry.box.mark.rollup ? t('twin.rollup') : ''}
			</button>
		</li>
	{/each}
	{#if entries.length > shown.length}
		<li>{t('twin.more', { count: entries.length - shown.length })}</li>
	{/if}
</ul>
