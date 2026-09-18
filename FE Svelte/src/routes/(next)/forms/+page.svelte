<script lang="ts">
	import { resolve } from '$app/paths';
	import TraceForms from '$lib/forms/TraceForms/TraceForms.svelte';

	const standalone = {
		kindHref: (kindId: string) => resolve('/(next)/forms/[kindId]', { kindId }),
		allHref: resolve('/forms')
	};
</script>

<TraceForms {standalone} />
