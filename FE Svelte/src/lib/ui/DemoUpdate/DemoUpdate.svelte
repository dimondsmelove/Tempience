<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { demoUpdate } from '$lib/state/DemoUpdate/DemoUpdate.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { triplit } from '$lib/state/triplit/client';
	import { reseedDemoAndReload } from '$lib/state/triplit/demo-actions';
	import {
		DEMO_UPDATE_CONFIRM_TEST_ID,
		DEMO_UPDATE_REBUILD_TEST_ID,
		DEMO_UPDATE_TEST_ID
	} from './constants';

	let confirming = $state(false);
	let busy = $state(false);
	/** What the rebuild failed with, read in the language of the moment. */
	let failure = $state.raw<unknown>(null);

	/** The same reseed the boot runs for an untouched demo: the reloading question first. */
	const rebuild = (): void => {
		draftGuard.exitReloading(() => {
			failure = null;
			busy = true;
			reseedDemoAndReload(triplit).catch((cause: unknown) => {
				failure = cause ?? new Error();
				busy = false;
			});
		});
	};
</script>

{#if demoUpdate.available}
	<div
		class="flex min-w-0 flex-wrap items-center gap-1 text-[length:var(--cg-text-size-caption)]"
		data-testid={DEMO_UPDATE_TEST_ID}
	>
		<span class="text-muted">{t('demo.update.available')}</span>
		{#if confirming}
			<span>{t('demo.update.confirm')}</span>
			<Button size="sm" disabled={busy} onclick={() => (confirming = false)}
				>{t('common.cancel')}</Button
			>
			<Button
				size="sm"
				variant="primary"
				data-testid={DEMO_UPDATE_CONFIRM_TEST_ID}
				disabled={busy}
				onclick={rebuild}>{busy ? t('dataSpace.resetting') : t('demo.update.rebuild')}</Button
			>
		{:else}
			<Button
				size="sm"
				data-testid={DEMO_UPDATE_REBUILD_TEST_ID}
				onclick={() => (confirming = true)}>{t('demo.update.rebuild')}</Button
			>
		{/if}
		{#if failure !== null}<span role="alert">{errorText(failure)}</span>{/if}
	</div>
{/if}
