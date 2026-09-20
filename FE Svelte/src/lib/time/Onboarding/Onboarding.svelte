<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { ONBOARDING_STEPS } from './constants';
	import { parseEmphasis } from './emphasis';
	import { paragraphKeys, STEP_TITLE_KEY } from './steps';
	import type { OnboardingProps } from './types';

	let { onstart, ondemo, onclose }: OnboardingProps = $props();
	const id = $props.id();
	const last = ONBOARDING_STEPS.length - 1;
	let index = $state(0);
	const step = $derived(ONBOARDING_STEPS[index]);
	const paragraphs = $derived(paragraphKeys(step));
</script>

<!-- Emphasis comes from the catalog as marks and is rendered as elements, never as HTML. -->
{#snippet rich(source: string)}
	{#each parseEmphasis(source) as run (run.start)}
		{#if run.kind === 'strong'}<strong class="font-semibold text-ink">{run.text}</strong
			>{:else if run.kind === 'em'}<em>{run.text}</em>{:else if run.kind === 'code'}<code
				class="font-mono text-xs text-ink">{run.text}</code
			>{:else}{run.text}{/if}
	{/each}
{/snippet}

{#snippet card(
	title: string,
	body: string,
	name: string,
	onclick: (() => void) | undefined,
	disabled: boolean
)}
	<button
		type="button"
		class="cg-panel flex cursor-pointer flex-col items-start border border-outline bg-raised text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50 disabled:hover:border-outline"
		aria-labelledby={name}
		aria-disabled={disabled}
		{disabled}
		{onclick}
	>
		<span id={name} class="font-semibold">{title}</span>
		<span class="text-sm leading-relaxed text-muted">{body}</span>
	</button>
{/snippet}

<!-- The section scrolls inside the shell; the card centres when it fits and starts at the top when it does not. -->
<section
	class="flex h-full min-h-0 overflow-auto bg-canvas p-4 text-ink sm:p-6"
	aria-label={t('onboarding.title')}
>
	<div class="m-auto w-full max-w-2xl space-y-5">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<p class="cg-label">
				{t('onboarding.progress', { n: index + 1, total: ONBOARDING_STEPS.length })}
			</p>
			{#if onclose}
				<Button size="sm" variant="quiet" onclick={onclose}>{t('onboarding.close')}</Button>
			{/if}
		</div>
		<h1 class="text-2xl font-semibold leading-tight">{t(STEP_TITLE_KEY[step])}</h1>
		{#if step === 'try'}
			<div class="grid gap-3 sm:grid-cols-2">
				{@render card(
					t('onboarding.try.demo.title'),
					t('onboarding.try.demo.body'),
					`${id}-demo`,
					ondemo,
					ondemo === undefined
				)}
				{@render card(
					t('onboarding.try.own.title'),
					t('onboarding.try.own.body'),
					`${id}-own`,
					onstart,
					false
				)}
			</div>
			<p class="text-xs leading-relaxed text-muted">{t('onboarding.storage')}</p>
		{:else}
			{#each paragraphs as key, position (key)}
				<p class={['text-sm leading-relaxed', position === 0 ? 'text-ink' : 'text-muted']}>
					{@render rich(t(key))}
				</p>
			{/each}
		{/if}
		<!-- Primary first, as everywhere in the app; the last screen keeps only «Назад». -->
		<div class="flex flex-wrap items-center gap-2">
			{#if index < last}
				<Button variant="primary" onclick={() => (index += 1)}>{t('onboarding.next')}</Button>
			{/if}
			{#if index > 0}
				<Button variant="quiet" onclick={() => (index -= 1)}>{t('onboarding.back')}</Button>
			{/if}
			{#if index < last}
				<Button variant="quiet" onclick={() => (index = last)}>{t('onboarding.skip')}</Button>
			{/if}
		</div>
	</div>
</section>
