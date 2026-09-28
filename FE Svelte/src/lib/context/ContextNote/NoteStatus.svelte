<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { NoteEditing } from './NoteEditing.svelte';

	let { editor }: { editor: NoteEditing } = $props();
</script>

<!-- What the last save said: its refusal, or that it was saved. -->
{#if editor.failure !== null}<p class="text-xs text-muted" role="alert">
		{errorText(editor.failure)}
	</p>
{:else if editor.notice}<p class="text-xs text-muted" role="status">{t(editor.notice)}</p>{/if}
