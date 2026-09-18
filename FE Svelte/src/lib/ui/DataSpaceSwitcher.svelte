<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import {
		DATA_SPACE_OPTIONS,
		dataSpaceLabel,
		isDataSpaceId,
		saveActiveDataSpaceId
	} from '$lib/state/triplit/data-space';

	let switching = $state(false);
	let failure = $state.raw<unknown>(null);
	const error = $derived(failure === null ? null : errorText(failure));

	const switchDataSpace = (event: Event): void => {
		const select = event.currentTarget as HTMLSelectElement;
		const nextId = select.value;
		if (!isDataSpaceId(nextId) || nextId === activeDataSpace.id) return;
		// The switch reloads the app: a changed form and input kept only in memory both end
		// with it, so both are asked about before the space changes.
		void draftGuard.confirmReloading().then((proceed) => {
			if (!proceed) {
				select.value = activeDataSpace.id;
				return;
			}
			failure = null;
			try {
				saveActiveDataSpaceId(nextId);
				switching = true;
				window.location.reload();
			} catch (cause: unknown) {
				failure = cause ?? new Error();
			}
		});
	};
</script>

<div class="flex min-w-0 items-center gap-1" title={error ?? t(activeDataSpace.descriptionKey)}>
	<select
		data-testid="data-space-switcher"
		data-kind={activeDataSpace.kind}
		aria-label={t('dataSpace.switcher')}
		aria-invalid={error ? 'true' : undefined}
		disabled={switching}
		value={activeDataSpace.id}
		onchange={switchDataSpace}
		class={`cg-control cg-control-sm data-space-select h-10 max-w-16 rounded-md border px-1 py-1 text-[0.65rem] disabled:opacity-60 sm:h-auto sm:max-w-44 sm:px-2 sm:text-xs ${
			activeDataSpace.kind === 'scenario'
				? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100'
				: 'border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
		}`}
	>
		{#each DATA_SPACE_OPTIONS as dataSpace (dataSpace.id)}
			<option value={dataSpace.id}>{dataSpaceLabel(dataSpace, t)}</option>
		{/each}
		{#if !DATA_SPACE_OPTIONS.some((dataSpace) => dataSpace.id === activeDataSpace.id)}
			<!-- A hidden DataSpace is never offered, but the switcher must still not lie about it. -->
			<option value={activeDataSpace.id}>{dataSpaceLabel(activeDataSpace, t)}</option>
		{/if}
	</select>
	{#if error}
		<span class="font-semibold text-red-600" aria-label={error}>!</span>
	{/if}
</div>
