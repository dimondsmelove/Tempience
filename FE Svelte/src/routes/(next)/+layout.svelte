<script lang="ts">
	import { ensureActiveScenarioSeed } from '$lib/scenarios';
	import AppShell from '$lib/shell/AppShell/AppShell.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';

	let { children } = $props();

	// The active scenario DataSpace is seeded once before the workbench mounts, the same way the
	// legacy screens seed before loading their first snapshot. Canonical data is never touched.
	const seeded = ensureActiveScenarioSeed();
</script>

<AppShell variant="time">
	{#await seeded then}
		{@render children()}
	{:catch error}
		<p class="cg-panel text-sm text-ink" role="alert">
			{t('shell.prepareFailed', {
				message: error instanceof Error ? error.message : String(error)
			})}
		</p>
	{/await}
</AppShell>
