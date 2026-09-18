<script lang="ts">
	import { CodedError } from '$lib/model/Errors/CodedError';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { onMount } from 'svelte';
	import Workbench from '$lib/time/Workbench/Workbench.svelte';
	import Onboarding from '$lib/time/Onboarding/Onboarding.svelte';
	import { ONBOARDING_COMPLETE_KEY } from '$lib/time/Onboarding/constants';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';

	let ready = $state(false);
	let completed = $state(false);
	const needsSetup = $derived(
		!completed &&
			activeDataSpace.kind === 'canonical' &&
			workbench.status === 'ready' &&
			workbench.snapshot.traces.length === 0 &&
			workbench.snapshot.scopes.length === 0
	);

	onMount(() => {
		try {
			completed = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === '1';
		} catch {
			/* Optional device preference. */
		}
		// Decide from persisted records before exposing setup to an existing user.
		void workbench.load(loadWorkbenchSnapshot).then(() => {
			ready = true;
		});
	});

	const createFirstGroup = async (name: string): Promise<void> => {
		const scope = await tempienceRepository.createScope({ name });
		await workbench.load(loadWorkbenchSnapshot);
		if (workbench.status !== 'ready')
			throw (
				workbench.failure ?? new CodedError('records_unreadable', 'the records could not be read')
			);
		completed = true;
		try {
			localStorage.setItem(ONBOARDING_COMPLETE_KEY, '1');
		} catch {
			/* The saved group also prevents setup on the next launch. */
		}
		workbench.selectScope(scope.id);
		workbench.openCapture();
	};
</script>

<svelte:head><title>Tempience</title></svelte:head>
{#if !ready}
	<p class="p-6 text-sm text-muted" role="status">{t('public.reading')}</p>
{:else if needsSetup}
	<Onboarding oncreate={createFirstGroup} />
{:else}
	<Workbench />
{/if}
