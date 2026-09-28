<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { bandSegments, CHAPTER_STATUS_KEYS, endOf, formatSpan, ms } from '$lib/model/Chapters';
	import type { Chapter } from '$lib/model/Chapters/types';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { TimeWindow } from '$lib/state/Viewport/types';
	import { chapterColour } from '$lib/theme/chapter-colour';
	import { WHEEL_LINE_PX } from '$lib/time/Axis/constants';
	import ChapterAdd from './ChapterAdd.svelte';
	import { BAND_HEIGHT_PX, BAND_NAME_HEIGHT_PX } from './constants';
	import { chapterLabel, labelRoom } from './label';

	type Props = Readonly<{
		chapters: readonly Chapter[];
		window: TimeWindow;
		now: number;
		/** The zone chapter boundaries are read in. */
		timeZone: string;
		pickedId: string | null;
		/** The chapter the rows follow: its segment takes the same tint as the rail's band header. */
		drivingId?: string | null;
		pickedStageId: string | null;
		onpick: (chapterId: string, stageId: string | null) => void;
		oncreate: () => void;
		/** The wheel pans the ribbon by this ratio of the window, as over the Axis. */
		onpan?: (ratio: number) => void;
	}>;
	let {
		chapters,
		window,
		now,
		timeZone,
		pickedId,
		drivingId = null,
		pickedStageId,
		onpick,
		oncreate,
		onpan
	}: Props = $props();

	/** The Axis's own wheel: the vertical wheel pans time, a line or a page counted as the Axis counts it. */
	const wheelInput: Attachment<HTMLElement> = (element) => {
		const onwheel = (event: WheelEvent): void => {
			const widthPx = element.clientWidth;
			if (!onpan || !event.deltaY || !widthPx) return;
			event.preventDefault();
			const unit =
				event.deltaMode === WheelEvent.DOM_DELTA_LINE
					? WHEEL_LINE_PX
					: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
						? widthPx
						: 1;
			onpan((-event.deltaY * unit) / widthPx);
		};
		element.addEventListener('wheel', onwheel, { passive: false });
		return () => element.removeEventListener('wheel', onwheel);
	};

	let width = $state(0);
	const segments = $derived(width > 0 ? bandSegments(chapters, window, width, now) : []);
	const byId = $derived(new Map(chapters.map((chapter) => [chapter.id, chapter])));
	const spanOf = (id: string): string => {
		const chapter = byId.get(id);
		return chapter ? formatSpan(ms(chapter.start), endOf(chapter), timeZone, locale.current) : '';
	};

	/** The band's own fonts, read once mounted: labels are measured, never guessed. */
	let fonts = $state.raw<Readonly<{ sans: string; mono: string }> | null>(null);
	const readFonts: Attachment<HTMLElement> = (element) => {
		const style = getComputedStyle(element);
		fonts = {
			sans: style.getPropertyValue('--cg-font-sans').trim() || style.fontFamily,
			mono: style.getPropertyValue('--cg-font-mono').trim() || 'monospace'
		};
	};
	let context: CanvasRenderingContext2D | null = null;
	const measure = (text: string, font: string): number => {
		context ??= document.createElement('canvas').getContext('2d');
		if (!context) return text.length * 7;
		context.font = font;
		return context.measureText(text).width;
	};
	/** What of a label fits: a chapter's name (cut down to a stub) and its dates beside it; a stage's name whole or not at all. */
	const chapterFit = (left: number, x1: number, name: string, dates: string, bold: boolean) => {
		const room = labelRoom(left, x1, width);
		if (!fonts) return { room, name: false, extra: false };
		const nameWidth = measure(name, `${bold ? 600 : 500} 12px ${fonts.sans}`);
		const datesWidth = measure(dates, `11px ${fonts.mono}`);
		return { room, ...chapterLabel(room, nameWidth, datesWidth) };
	};
	const stageFits = (left: number, x1: number, name: string, bold: boolean): boolean =>
		fonts !== null &&
		measure(name, `${bold ? 600 : 400} 11px ${fonts.sans}`) <= labelRoom(left, x1, width);
</script>

<!-- The chapters as a row of the axis (issue #82): each chapter a stretch of time with its name
     on top and its stages under it; it pans and zooms with the ribbon. -->
<div
	class="band"
	role="group"
	aria-label={t('chapter.band')}
	data-testid="chapter-band"
	style:height="{BAND_HEIGHT_PX}px"
	style:--name-height="{BAND_NAME_HEIGHT_PX}px"
	bind:clientWidth={width}
	{@attach readFonts}
	{@attach wheelInput}
>
	{#each segments as segment (segment.id)}
		{@const left = Math.max(segment.x0, 0)}
		{@const right = Math.min(segment.x1, width)}
		{@const chapter = byId.get(segment.id)}
		{@const dates = spanOf(segment.id)}
		{@const fit = chapterFit(left, segment.x1, segment.name, dates, segment.status === 'current')}
		<button
			type="button"
			class="chapter"
			data-status={segment.status}
			data-open={segment.open || undefined}
			data-testid="chapter-segment"
			data-chapter-id={segment.id}
			data-label={fit.name ? (fit.extra ? 'full' : 'name') : 'none'}
			data-driving={drivingId === segment.id || undefined}
			aria-pressed={pickedId === segment.id}
			aria-label={t('chapter.segmentLabel', {
				name: segment.name,
				dates,
				status: t(CHAPTER_STATUS_KEYS[segment.status])
			})}
			title="{segment.name} · {dates} · {t(CHAPTER_STATUS_KEYS[segment.status])}"
			style:left="{left}px"
			style:width="{Math.max(right - left, 0)}px"
			style:--chapter={chapterColour(chapter)}
			onclick={() => onpick(segment.id, null)}
		>
			<span class="stripe"></span>
			{#if fit.name}<span class="name" style:max-width="{Math.max(fit.room, 0)}px"
					>{segment.name}</span
				>{/if}
			{#if fit.extra}<span class="dates">{dates}</span>{/if}
		</button>
		{#each segment.stages as stage (stage.id)}
			{@const stageLeft = Math.max(stage.x0, 0)}
			<button
				type="button"
				class="stage"
				data-current={stage.current || undefined}
				data-testid="chapter-stage"
				aria-pressed={pickedId === segment.id && pickedStageId === stage.id}
				aria-label={t('chapter.stageLabel', { stage: stage.name, chapter: segment.name })}
				title={t('chapter.stageTitle', { name: stage.name })}
				style:left="{stageLeft}px"
				style:width="{Math.max(Math.min(stage.x1, width) - stageLeft, 0)}px"
				style:--chapter={chapterColour(chapter)}
				onclick={() => onpick(segment.id, stage.id)}
				>{#if stageFits(stageLeft, stage.x1, stage.name, stage.current)}{stage.name}{/if}</button
			>
		{/each}
		{#if segment.x0 >= 0}
			<span
				class="edge"
				data-future={segment.status === 'future' || undefined}
				style:left="{segment.x0}px"
				style:--chapter={chapterColour(byId.get(segment.id))}
				aria-hidden="true"
			></span>
		{/if}
	{/each}
	<span class="add-slot"><ChapterAdd onclick={oncreate} /></span>
</div>

<style>
	.band {
		position: relative;
		flex: none;
		overflow: hidden;
		border-top: var(--cg-border-width) solid var(--cg-border-default);
		background: var(--cg-bg-surface);
		font-family: var(--cg-font-sans);
	}
	.chapter {
		position: absolute;
		top: 0;
		height: var(--name-height);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 6px 0;
		overflow: hidden;
		border: 0;
		background: transparent;
		color: var(--cg-text-secondary);
		font-size: 12px;
		line-height: 1;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}
	.chapter:hover,
	.chapter[data-driving] {
		background: color-mix(in oklab, var(--chapter) 10%, transparent);
	}
	.chapter:focus-visible,
	.stage:focus-visible {
		outline: 2px solid var(--cg-accent);
		outline-offset: -2px;
	}
	/* Selection is form, not colour (DESIGN §1): a ring around the chosen chapter. */
	.chapter[aria-pressed='true'] {
		box-shadow: inset 0 0 0 1px var(--cg-text-primary);
	}
	.stripe {
		position: absolute;
		inset: 0 0 auto 0;
		height: 3px;
		background: var(--chapter);
		opacity: 0.5;
	}
	.chapter[data-status='current'] .stripe {
		opacity: 1;
	}
	.chapter[data-status='future'] .stripe {
		background: transparent;
		border-top: 2px dashed var(--chapter);
		opacity: 0.9;
	}
	.chapter[data-open] .stripe {
		mask-image: linear-gradient(90deg, #000 70%, transparent);
	}
	.name {
		flex: none;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--cg-text-primary);
		font-weight: 500;
	}
	.chapter[data-status='current'] .name {
		font-weight: 600;
	}
	.chapter[data-status='past'] .name {
		color: var(--cg-text-secondary);
	}
	.dates {
		font-family: var(--cg-font-mono);
		font-size: 11px;
		color: var(--cg-text-muted);
	}
	.stage {
		position: absolute;
		top: var(--name-height);
		bottom: 0;
		padding: 0 6px;
		overflow: hidden;
		border: 0;
		border-left: 1px solid color-mix(in oklab, var(--chapter) 55%, transparent);
		background: transparent;
		color: var(--cg-text-muted);
		font-size: 11px;
		line-height: 1;
		text-align: left;
		white-space: nowrap;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.stage:hover {
		color: var(--cg-text-primary);
	}
	.stage[data-current] {
		color: var(--cg-text-primary);
		font-weight: 600;
	}
	.stage[aria-pressed='true'] {
		box-shadow: inset 0 -2px 0 var(--cg-text-primary);
	}
	.edge {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 0;
		border-left: 1px solid var(--chapter);
		pointer-events: none;
	}
	.edge[data-future] {
		border-left-style: dashed;
	}
	.add-slot {
		position: absolute;
		top: 2px;
		right: 4px;
		display: flex;
	}
</style>
