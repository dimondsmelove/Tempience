<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { LOCALES } from '$lib/state/Locale/constants';
	import { errorText } from '$lib/state/Locale/errors';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { activeDataSpace, triplit } from '$lib/state/triplit/client';
	import { DEMO_DATA_SPACE_ID } from '$lib/state/triplit/data-space';
	import { demoSeedLocale, reseedDemoAndReload } from '$lib/state/triplit/demo-actions';
	import {
		DEMO_LANGUAGE_CONFIRM_TEST_ID,
		DEMO_LANGUAGE_REBUILD_TEST_ID,
		DEMO_LANGUAGE_TEST_ID
	} from './constants';
	import type { LanguageName } from './types';

	// The active DataSpace is fixed for the module lifetime: a space switch reloads the app.
	const demo = activeDataSpace.id === DEMO_DATA_SPACE_ID;
	// A fresh replica is seeded on boot, after this header mounted, so the marker is read again
	// whenever the language changes — the only moment the notebook and the interface can start to
	// differ. A rebuild reloads the app.
	const seeded = $derived.by(() => {
		void locale.current;
		return demo ? demoSeedLocale() : null;
	});
	const languageName: LanguageName = (value) =>
		LOCALES.find((option) => option.value === value)?.label ?? value;
	let confirming = $state(false);
	let busy = $state(false);
	/** What the rebuild failed with, read in the language of the moment. */
	let failure = $state.raw<unknown>(null);

	/** The same reseed the picker runs for an untouched demo: the reloading question first. */
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

{#if seeded !== null && seeded !== locale.current}
	<div
		class="flex min-w-0 flex-wrap items-center gap-1 text-[length:var(--cg-text-size-caption)]"
		data-testid={DEMO_LANGUAGE_TEST_ID}
	>
		<span class="text-muted"
			>{t('demo.language.seeded', { context: seeded, language: languageName(seeded) })}</span
		>
		{#if confirming}
			<span>{t('demo.language.confirm')}</span>
			<Button size="sm" disabled={busy} onclick={() => (confirming = false)}
				>{t('common.cancel')}</Button
			>
			<Button
				size="sm"
				variant="primary"
				data-testid={DEMO_LANGUAGE_CONFIRM_TEST_ID}
				disabled={busy}
				onclick={rebuild}
				>{busy
					? t('dataSpace.resetting')
					: t('demo.language.rebuild', {
							context: locale.current,
							language: languageName(locale.current)
						})}</Button
			>
		{:else}
			<Button
				size="sm"
				data-testid={DEMO_LANGUAGE_REBUILD_TEST_ID}
				onclick={() => (confirming = true)}
				>{t('demo.language.rebuild', {
					context: locale.current,
					language: languageName(locale.current)
				})}</Button
			>
		{/if}
		{#if failure !== null}<span role="alert">{errorText(failure)}</span>{/if}
	</div>
{/if}
