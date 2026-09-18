<script lang="ts">
	import AppShell from '$lib/shell/AppShell/AppShell.svelte';

	let { children } = $props();
</script>

<AppShell>
	{@render children()}
</AppShell>
