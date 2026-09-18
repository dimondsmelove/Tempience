<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { CodedError } from '$lib/model/Errors/CodedError';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { OnboardingProps, OnboardingStep } from './types';
	let { oncreate, onskip }: OnboardingProps = $props();
	let step = $state<OnboardingStep>('intro');
	let name = $state('');
	let busy = $state(false);
	/** What the last attempt failed with, read in the language of the moment. */
	let failure = $state.raw<unknown>(null);
	const create = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		if (busy) return;
		if (!name.trim()) {
			failure = new CodedError('onboarding_group_name', 'the group needs a name');
			return;
		}
		busy = true;
		failure = null;
		try {
			await oncreate(name.trim());
		} catch (cause) {
			failure = cause ?? new CodedError('onboarding_group', 'the group could not be created');
		} finally {
			busy = false;
		}
	};
</script>

<section
	class="flex h-full min-h-0 items-center justify-center overflow-auto bg-canvas p-6 text-ink"
	aria-label={t('onboarding.title')}
>
	<div class="w-full max-w-md space-y-5">
		<p class="cg-label">
			{step === 'intro' ? t('onboarding.step1') : t('onboarding.step2')}
		</p>
		{#if step === 'intro'}
			<h1 class="text-2xl font-semibold leading-tight">{t('onboarding.heading')}</h1>
			<p class="text-sm leading-relaxed text-muted">{t('onboarding.intro')}</p>
			<p class="text-sm leading-relaxed text-muted">{t('onboarding.storage')}</p>
			<Button variant="primary" onclick={() => (step = 'group')}>{t('onboarding.start')}</Button>
		{:else}
			<h1 class="text-2xl font-semibold leading-tight">{t('onboarding.groupsHeading')}</h1>
			<p class="text-sm leading-relaxed text-muted">{t('onboarding.groupsWhat')}</p>
			<p class="text-sm leading-relaxed text-muted">{t('onboarding.groupsOptional')}</p>
			<form class="space-y-4" onsubmit={create}>
				<label class="block space-y-2">
					<span class="cg-label">{t('onboarding.groupName')}</span>
					<input
						class="cg-field w-full"
						bind:value={name}
						placeholder={t('onboarding.groupPlaceholder')}
						maxlength="200"
						disabled={busy}
						autocomplete="off"
					/>
				</label>
				{#if failure !== null}<p class="text-sm" role="alert">{errorText(failure)}</p>{/if}
				<div class="flex flex-wrap gap-2">
					<Button type="submit" variant="primary" disabled={busy || !name.trim()}
						>{busy ? t('onboarding.preparing') : t('onboarding.createGroup')}</Button
					>
					<Button disabled={busy} onclick={onskip}>{t('onboarding.skipGroup')}</Button>
					<Button variant="quiet" disabled={busy} onclick={() => (step = 'intro')}
						>{t('onboarding.back')}</Button
					>
				</div>
			</form>
		{/if}
	</div>
</section>
