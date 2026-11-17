<script lang="ts">
	import TraceEditor from '$lib/context/TraceEditor/TraceEditor.svelte';
	import { openDraft } from '$lib/state/TraceDraft/open.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { untrack } from 'svelte';
	let { id, onclose }: { id: string; onclose: () => void } = $props();
	const initial = untrack(() => ({ id, onclose }));
	const draft = openDraft({ mode: 'edit', traceId: initial.id });
</script>

<section aria-label={t('intentions.editor')}>
	<TraceEditor taskMode {draft} onopen={async () => onclose()} oncancel={onclose} />
</section>
