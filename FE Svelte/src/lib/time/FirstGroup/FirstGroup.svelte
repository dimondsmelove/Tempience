<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { CodedError } from '$lib/model/Errors/CodedError';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { FIRST_GROUP_NAME_MAXLENGTH } from './constants';
	import type { FirstGroupProps } from './types';

	let { oncreate, onskip, ondemo }: FirstGroupProps = $props();
	let name = $state('');
	let busy = $state(false);
	/** What the last attempt failed with, read in the language of the moment. */
	let failure = $state.raw<unknown>(null);

	const create = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		if (busy) return;
		if (!name.trim()) {
			failure = new CodedError('onboarding_group_name', 'the scope needs a name');
			return;
		}
		busy = true;
		failure = null;
		try {
			await oncreate(name.trim());
		} catch (cause) {
			failure = cause ?? new CodedError('onboarding_group', 'the scope could not be created');
		} finally {
			busy = false;
		}
	};
</script>

<section
	class="flex h-full min-h-0 overflow-auto bg-canvas p-4 text-ink sm:p-6"
	aria-label={t('firstGroup.title')}
>
	<div class="m-auto w-full max-w-md space-y-5">
		<h1 class="text-2xl font-semibold leading-tight">{t('firstGroup.heading')}</h1>
		<p class="text-sm leading-relaxed text-muted">{t('firstGroup.what')}</p>
		<p class="text-sm leading-relaxed text-muted">{t('firstGroup.optional')}</p>
		<form class="space-y-4" onsubmit={create}>
			<label class="block space-y-2">
				<span class="cg-label">{t('firstGroup.name')}</span>
				<input
					class="cg-field w-full"
					bind:value={name}
					placeholder={t('firstGroup.placeholder')}
					maxlength={FIRST_GROUP_NAME_MAXLENGTH}
					disabled={busy}
					autocomplete="off"
				/>
			</label>
			{#if failure !== null}<p class="text-sm" role="alert">{errorText(failure)}</p>{/if}
			<div class="flex flex-wrap gap-2">
				<Button type="submit" variant="primary" disabled={busy || !name.trim()}
					>{busy ? t('firstGroup.preparing') : t('firstGroup.create')}</Button
				>
				<Button disabled={busy} onclick={onskip}>{t('firstGroup.skip')}</Button>
			</div>
		</form>
		{#if ondemo}
			<Button variant="quiet" disabled={busy} onclick={ondemo}>{t('firstGroup.demo')}</Button>
		{/if}
	</div>
</section>
