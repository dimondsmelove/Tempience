<script lang="ts">
	import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
	let { outcome = null, size = 16 }: { outcome?: IntentionOutcome | null; size?: 14 | 16 } =
		$props();
</script>

<span
	aria-hidden="true"
	class="icon"
	class:partial={outcome === 'partial'}
	class:alternative={outcome === 'alternative'}
	class:completed={outcome === 'completed'}
	style:--size={`${size}px`}
	>{outcome === 'completed' ? '✓' : outcome === 'not_completed' ? '×' : ''}</span
>

<style>
	.icon {
		display: inline-grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		box-sizing: border-box;
		border: 1px solid var(--cg-text-muted);
		border-radius: 50%;
		color: var(--cg-text-muted);
		font-size: 12px;
		line-height: 1;
	}
	.partial {
		background: linear-gradient(to right, var(--cg-text-muted) 50%, transparent 50%);
	}
	.alternative {
		border-style: dashed;
	}
	.completed {
		background: var(--cg-accent);
		border-color: var(--cg-accent);
		color: var(--cg-bg-canvas);
		font-weight: bold;
	}
</style>
