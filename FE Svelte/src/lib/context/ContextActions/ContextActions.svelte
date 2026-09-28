<script lang="ts">
	import type { ContextActionsProps } from './types';

	let { label, children }: ContextActionsProps = $props();
</script>

<!-- One row of actions, icons or words, wrapping when they outgrow the Context; the name of
     each action is its tooltip and its accessible name. -->
<div class="flex flex-wrap items-center gap-1" role="group" aria-label={label}>
	{@render children()}
</div>
