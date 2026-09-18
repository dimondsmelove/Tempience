<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import TraceForms from '$lib/forms/TraceForms/TraceForms.svelte';

	const standalone = {
		kindHref: (kindId: string) => resolve('/(next)/forms/[kindId]', { kindId }),
		allHref: resolve('/forms')
	};
</script>

{#key page.params.kindId}<TraceForms kindId={page.params.kindId} {standalone} />{/key}
