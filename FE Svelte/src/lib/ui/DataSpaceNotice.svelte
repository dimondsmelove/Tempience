<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { activeDataSpace, triplit } from '$lib/state/triplit/client';
	import { resetScenarioDataSpace } from '$lib/state/triplit/data-space';

	let confirmingReset = $state(false);
	let resetting = $state(false);
	let failure = $state.raw<unknown>(null);

	const resetScenario = async (): Promise<void> => {
		resetting = true;
		failure = null;
		try {
			await resetScenarioDataSpace(activeDataSpace, triplit);
			window.location.reload();
		} catch (cause: unknown) {
			failure = cause ?? new Error();
			resetting = false;
		}
	};
</script>

{#if activeDataSpace.kind === 'scenario'}
	<details data-testid="scenario-data-space-menu" class="relative text-xs">
		<summary
			class="data-space-trigger inline-grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-md border border-amber-400 px-2 py-1 font-medium"
			aria-label={t('dataSpace.actions')}
			title={t('dataSpace.actions')}>⋯</summary
		>
		<div
			class="cg-popover fixed right-2 top-[3.5rem] z-50 flex w-[calc(100vw-1rem)] max-w-72 sm:absolute sm:right-0 sm:top-full sm:mt-2 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-xl dark:border-gray-700 dark:bg-gray-900"
		>
			{#if confirmingReset}
				<span>{t('dataSpace.resetConfirm')}</span>
				<button
					type="button"
					class="data-space-action min-h-11 rounded border border-amber-500 px-2 py-1 hover:bg-amber-100 disabled:opacity-60 dark:hover:bg-amber-900"
					disabled={resetting}
					onclick={() => (confirmingReset = false)}
				>
					{t('common.cancel')}
				</button>
				<button
					type="button"
					data-testid="confirm-scenario-reset"
					class="data-space-action data-space-danger min-h-11 rounded bg-red-700 px-2 py-1 font-medium text-white hover:bg-red-800 disabled:opacity-60"
					disabled={resetting}
					onclick={() => void resetScenario()}
				>
					{resetting ? t('dataSpace.resetting') : t('dataSpace.resetData')}
				</button>
			{:else}
				<button
					type="button"
					data-testid="scenario-reset"
					class="data-space-action min-h-11 rounded border border-amber-500 px-2 py-1 hover:bg-amber-100 dark:hover:bg-amber-900"
					onclick={() => (confirmingReset = true)}
				>
					{t('dataSpace.reset')}
				</button>
			{/if}
			{#if failure !== null}
				<p class="w-full text-red-700 dark:text-red-300" role="alert">{errorText(failure)}</p>
			{/if}
		</div>
	</details>
{/if}
