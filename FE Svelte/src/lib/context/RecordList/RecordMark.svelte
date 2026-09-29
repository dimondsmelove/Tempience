<script lang="ts">
	import { markPaint } from '$lib/model/RecordMark/RecordMark';
	import type { RecordMarkProps } from './types';

	let { shape, colours }: RecordMarkProps = $props();
	/** Ink stands in when no Scope of the record has a colour, as on the ribbon. */
	const paint = $derived(markPaint(shape, colours, 'var(--cg-text-muted)'));
</script>

<!-- A record's mark as the ribbon draws it, at 14 px, in the colours of all its Scopes: one
     colour plainly, several woven (layers; stripes along an interval's band), the head a pixel
     wider when woven; a fact a capsule, an interval a head and a 30 % band, a vague date a haze
     over the window, a vague interval the band alone, an intention dotted. -->
<span class="mark" data-shape={shape} data-woven={paint.woven || undefined} aria-hidden="true">
	{#if paint.headFill}<span
			class={['head', paint.dotted && 'dotted']}
			style:width="{paint.head}px"
			style:background={paint.headFill}
		></span>{/if}
	{#if paint.bandFill}<span
			class="band"
			style:width="{paint.band}px"
			style:background={paint.bandFill}
		></span>{/if}
</span>

<style>
	.mark {
		display: inline-flex;
		flex: none;
		height: 14px;
	}
	.head {
		height: 100%;
		border-radius: 1.5px;
	}
	.band {
		height: 100%;
		border-radius: 0 2px 2px 0;
	}
	.mark[data-shape='fuzzySpan'] .band {
		border-radius: 2px;
	}
	/* The haze: densest in the middle, nothing at the ends, as on the ribbon. */
	.mark[data-shape='fuzzy'] .band {
		mask-image: linear-gradient(90deg, transparent, #000 50%, transparent);
	}
	/* The intention's tick: 3 px dots, 2 px gaps, whatever colours it weaves. */
	.dotted {
		mask-image: repeating-linear-gradient(180deg, #000 0 3px, transparent 3px 5px);
	}
</style>
