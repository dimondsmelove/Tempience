<script lang="ts">
	import { page } from '$app/state';
	import TimeInputPrototype from '$lib/experiments/TimeInputPrototype/TimeInputPrototype.svelte';
</script>

<svelte:head><title>Выбор времени · Tempience</title></svelte:head>
<TimeInputPrototype standalone={page.url.searchParams.get('view') === 'field'} />
