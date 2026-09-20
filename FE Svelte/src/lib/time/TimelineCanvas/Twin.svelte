<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { HoverTarget } from '$lib/model/Hover/types';
	import type { Caption, MarkBox } from '$lib/model/Labels/types';
	import type { RibbonLayout } from '$lib/model/Layout/types';
	import { underVeil } from '$lib/model/Lens/Lens';
	import type { LensSet } from '$lib/model/Lens/types';
	import { TWIN_LIMIT } from './constants';
	import type { SelectSource } from './types';

	type Props = Readonly<{
		layout: RibbonLayout | null;
		/** The captions the canvas drew last, row by row (the layout's within the budget, plus the forced). */
		captions: readonly Caption[][] | null;
		selectedTraceId: string | null;
		/** Records in full force: the focus and the lens as one (loop 008); `data-lit` on their buttons. */
		lit: ReadonlySet<string>;
		/** What the pointer rests on and what the lens draws above the veil; the rest is `data-veiled` while the veil is on. */
		hover: HoverTarget;
		lens: LensSet;
		veiled: boolean;
		onselect: (traceId: string, source: SelectSource) => void;
	}>;
	let { layout, captions, selectedTraceId, lit, hover, lens, veiled, onselect }: Props = $props();

	type Entry = Readonly<{
		box: MarkBox;
		rowName: string;
		/**
		 * The caption as drawn right now — cut, or in full while forced — or none (Q1-A). Its
		 * rectangle is the caption's hit area: what the canvas shows is what a click lands on (pack 4, B).
		 */
		caption: Caption | null;
		/** No other mark of the row touches this one, so a click on it is unambiguous. */
		alone: boolean;
	}>;
	const touches = (a: MarkBox, b: MarkBox): boolean =>
		a.x0 <= b.x1 + 2 && a.x1 >= b.x0 - 2 && a.y0 <= b.y1 + 2 && a.y1 >= b.y0 - 2;
	const entries = $derived.by((): Entry[] => {
		if (!layout) return [];
		const list: Entry[] = [];
		layout.rows.forEach((row, rowIndex) => {
			const drawn = captions?.[rowIndex] ?? [];
			for (const box of row.boxes) {
				if (box.x1 < 0 || box.x0 > layout.widthPx) continue;
				const caption = drawn.find((candidate) => candidate.label.markId === box.mark.id) ?? null;
				const alone = !row.boxes.some((other) => other !== box && touches(box, other));
				list.push({ box, rowName: row.row.name, caption, alone });
			}
		});
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
				data-h={(entry.box.y1 - entry.box.y0).toFixed(1)}
				data-open={entry.box.mark.open || undefined}
				data-closed-at={entry.box.mark.closedAt === undefined
					? undefined
					: new Date(entry.box.mark.closedAt).toISOString()}
				data-result={entry.box.mark.result || undefined}
				data-hues={entry.box.mark.colours?.map((colour) => colour.hue).join(' ')}
				data-label-x={entry.caption
					? centre(entry.caption.label.x, entry.caption.label.x + entry.caption.label.width)
					: undefined}
				data-label-y={entry.caption
					? centre(entry.caption.label.y, entry.caption.label.y + entry.caption.label.height)
					: undefined}
				data-label-w={entry.caption?.label.width.toFixed(1)}
				data-caption={entry.caption?.label.text}
				data-caption-plate={entry.caption?.backing || undefined}
				data-lit={lit.has(entry.box.mark.traceId) ? 'true' : undefined}
				data-veiled={veiled && underVeil(hover, lens, entry.box.mark) ? 'true' : undefined}
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
