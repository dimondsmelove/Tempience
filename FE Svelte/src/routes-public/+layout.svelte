<script lang="ts">
	import RootLayout from '../routes/+layout.svelte';
	import TimeLayout from '../routes/(next)/+layout.svelte';
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<RootLayout><TimeLayout>{@render children()}</TimeLayout></RootLayout>
