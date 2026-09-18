<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>{t('public.localTitle')}</title></svelte:head>
<main class="mx-auto max-w-xl space-y-4 p-6 text-ink">
	<h1 class="text-xl font-semibold">{t('pair.notConfigured')}</h1>
	<p>{t('public.localIntro')}</p>
	<p>{t('public.localTransfer')}</p>
	<a class="cg-control inline-flex" href={resolve('/')}>{t('public.toRecords')}</a>
</main>
