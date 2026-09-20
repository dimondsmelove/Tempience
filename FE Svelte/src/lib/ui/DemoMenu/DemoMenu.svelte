<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { tour } from '$lib/state/Tour/Tour.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { activeDataSpace, triplit } from '$lib/state/triplit/client';
	import { DEMO_DATA_SPACE_ID } from '$lib/state/triplit/data-space';
	import { deleteDemoAndReload, openDemoAndReload } from '$lib/state/triplit/demo-actions';
	import { DEMO_MENU_CONFIRM_DELETE_TEST_ID, DEMO_MENU_DELETE_TEST_ID } from './constants';
	import type { DemoMenuProps } from './types';

	let { onleave }: DemoMenuProps = $props();
	const id = $props.id();
	// The active DataSpace is fixed for the module lifetime: a switch reloads the app.
	const demo = activeDataSpace.id === DEMO_DATA_SPACE_ID;
	let confirming = $state(false);
	let busy = $state(false);
	/** What the last step failed with, read in the language of the moment. */
	let failure = $state.raw<unknown>(null);

	const openTour = (): void => {
		onleave?.();
		tour.show();
	};

	/** Opening the demo reloads the app, so an open form and retained input are asked about first. */
	const openDemo = (): void => {
		draftGuard.exitReloading(() => {
			failure = null;
			busy = true;
			try {
				openDemoAndReload();
			} catch (cause: unknown) {
				failure = cause ?? new Error();
				busy = false;
			}
		});
	};

	/** The same flow as the space menu's «Удалить демо»: the replica goes whole, «Мои данные» opens. */
	const deleteDemo = async (): Promise<void> => {
		failure = null;
		busy = true;
		try {
			await deleteDemoAndReload(activeDataSpace, triplit);
		} catch (cause: unknown) {
			failure = cause ?? new Error();
			busy = false;
		}
	};
</script>

<section
	class="mt-3 space-y-2 border-t border-outline pt-2"
	aria-labelledby={`${id}-title`}
	data-testid="demo-menu"
>
	<h3 id={`${id}-title`} class="cg-label">{t('demo.menu.title')}</h3>
	<Button size="sm" onclick={openTour}>{t('onboarding.menu.open')}</Button>
	{#if !demo}
		<Button size="sm" disabled={busy} onclick={openDemo}>{t('demo.menu.open')}</Button>
	{:else}
		<p>{t('demo.notice')}</p>
		{#if confirming}
			<p>{t('demo.deleteConfirm')}</p>
			<div class="flex flex-wrap gap-2">
				<Button size="sm" disabled={busy} onclick={() => (confirming = false)}
					>{t('common.cancel')}</Button
				>
				<Button
					size="sm"
					variant="primary"
					data-testid={DEMO_MENU_CONFIRM_DELETE_TEST_ID}
					disabled={busy}
					onclick={() => void deleteDemo()}
					>{busy ? t('dataSpace.resetting') : t('demo.delete')}</Button
				>
			</div>
		{:else}
			<Button size="sm" data-testid={DEMO_MENU_DELETE_TEST_ID} onclick={() => (confirming = true)}
				>{t('demo.delete')}</Button
			>
		{/if}
	{/if}
	{#if failure !== null}<p role="alert">{errorText(failure)}</p>{/if}
</section>
