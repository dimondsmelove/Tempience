<script lang="ts">
	import PairDevice from '$lib/ui/PairDevice/PairDevice.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
</script>

<svelte:head>
	<title>{t('pair.title')} · Tempience</title>
</svelte:head>

<PairDevice />
