<script lang="ts">
	import { CodedError } from '$lib/model/Errors/CodedError';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { onMount } from 'svelte';
	import Workbench from '$lib/time/Workbench/Workbench.svelte';
	import Onboarding from '$lib/time/Onboarding/Onboarding.svelte';
	import { ONBOARDING_COMPLETE_KEY } from '$lib/time/Onboarding/constants';
	import FirstGroup from '$lib/time/FirstGroup/FirstGroup.svelte';
	import type { DemoStoryEntry } from '$lib/scenarios/demo/registry';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { openDemoAndReload } from '$lib/state/triplit/demo-actions';
	import { publicScreen } from './screen';

	let ready = $state(false);
	let completed = $state(false);
	/** «Начать без Scope» in this session: the workbench opens at once, with the capture form. */
	let skipped = $state(false);
	/** Own space with nothing in it: the tour first, then the first Scope until something is kept. */
	const empty = $derived(
		activeDataSpace.kind === 'canonical' &&
			workbench.status === 'ready' &&
			workbench.snapshot.traces.length === 0 &&
			workbench.snapshot.scopes.length === 0
	);
	const screen = $derived(publicScreen({ ready, empty, completed, skipped }));

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

	const remember = (): void => {
		completed = true;
		try {
			localStorage.setItem(ONBOARDING_COMPLETE_KEY, '1');
		} catch {
			/* The first saved record or Scope also prevents the tour on the next launch. */
		}
	};

	const finishIntro = (): void => {
		remember();
	};

	/** «Начать без Scope»: the workbench opens with the capture form, so the press is visible. */
	const finishSetup = (): void => {
		remember();
		skipped = true;
		workbench.openCapture();
	};

	/** A card of the demo catalog: the tour counts as seen; the app reloads into that story's space (no form is open on these screens). */
	const openDemo = (entry: DemoStoryEntry): void => {
		remember();
		openDemoAndReload(entry);
	};

	const createFirstGroup = async (name: string): Promise<void> => {
		const scope = await tempienceRepository.createScope({ name });
		await workbench.load(loadWorkbenchSnapshot);
		if (workbench.status !== 'ready')
			throw (
				workbench.failure ?? new CodedError('records_unreadable', 'the records could not be read')
			);
		workbench.selectScope(scope.id);
		remember();
		// The first record starts inside the first Scope: the entry names it, as «Записать сюда» does.
		workbench.openCapture({ scopeId: scope.id });
	};
</script>

<svelte:head><title>Tempience</title></svelte:head>
{#if screen === 'reading'}
	<p class="p-6 text-sm text-muted" role="status">{t('public.reading')}</p>
{:else if screen === 'tour'}
	<Onboarding onstart={finishIntro} ondemo={openDemo} />
{:else if screen === 'firstScope'}
	<FirstGroup oncreate={createFirstGroup} onskip={finishSetup} ondemo={openDemo} />
{:else}
	<Workbench />
{/if}
