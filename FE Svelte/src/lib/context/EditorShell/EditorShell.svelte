<script lang="ts">
	import type { EditorShellProps } from './types';

	let { heading, testId, busy = false, children, alerts, actions }: EditorShellProps = $props();
</script>

<!-- Every Context editor: its heading, its fields, what refused, and save / cancel; a write
     under way holds all of it (ScopeEditor's shape). While a time is chosen the time input
     takes the whole Context, as in the record form: everything else steps aside. -->
<section class="shell grid gap-3" data-testid={testId} aria-label={heading}>
	<h2 class="text-lg font-semibold">{heading}</h2>
	<fieldset disabled={busy} class="grid min-w-0 gap-3 border-0 p-0">
		{@render children()}
		{@render alerts?.()}
		<div class="flex flex-wrap gap-2">
			{@render actions()}
		</div>
	</fieldset>
</section>

<style>
	/* Only while a time is chosen: the shell, its fieldset and the field's own wrapper fill the Context. */
	.shell:has(:global(.span-field.editing)),
	.shell:has(:global(.span-field.editing)) > fieldset,
	.shell:has(:global(.span-field.editing)) > fieldset > :global(:has(.span-field.editing)) {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		gap: 0;
	}
	/* ...and everything else steps aside until the time is applied or cancelled. */
	.shell:has(:global(.span-field.editing)) > h2,
	.shell:has(:global(.span-field.editing))
		> fieldset
		> :global(:not(:has(.span-field.editing)):not(.span-field)),
	.shell:has(:global(.span-field.editing))
		> fieldset
		:global(:has(> .span-field.editing) > :not(.span-field)) {
		display: none;
	}
</style>
