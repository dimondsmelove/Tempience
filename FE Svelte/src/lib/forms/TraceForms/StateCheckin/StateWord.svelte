<script lang="ts" module>
	import type { StateFieldRefs } from './types';
	declare module '@sjsf/form' {
		interface ComponentProps {
			stateWordWidget: ComponentProps['textWidget'];
		}
		interface ComponentBindings {
			stateWordWidget: 'value';
		}
		interface UiOptions {
			stateFields?: StateFieldRefs;
		}
	}
</script>

<script lang="ts">
	import {
		getFormContext,
		getValueSnapshot,
		inputAttributes,
		retrieveUiOption,
		type ComponentProps
	} from '@sjsf/form';
	import TextInput from '@sjsf/basic-theme/widgets/text.svelte';
	import { candidates, quadrant, isScale } from '$lib/model/StateCheckin/state';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	let {
		value = $bindable(),
		config,
		handlers,
		...rest
	}: ComponentProps['stateWordWidget'] = $props();
	const context = getFormContext<Record<string, unknown>>();
	const refs = $derived(retrieveUiOption(context, config, 'stateFields'));
	const answers = $derived(getValueSnapshot(context) as Record<string, unknown>);
	const attributes = $derived(inputAttributes(context, config, 'text', handlers, {}));
	const suggestion = $derived.by(() => {
		if (!refs) return null;
		const energy = answers[refs.energy],
			tension = answers[refs.tension],
			mood = answers[refs.mood];
		if (!isScale(energy) || !isScale(tension) || !isScale(mood)) return null;
		return {
			quadrant: quadrant(energy, tension),
			words: candidates(energy, tension, mood, Infinity)
		};
	});
	function choose(word: string) {
		value = word;
		handlers.oninput?.();
		handlers.onchange?.();
	}
</script>

<div class="grid min-w-0 gap-3" data-testid="state-word">
	<div aria-live="polite" aria-atomic="true">
		{#if suggestion}
			<p class="font-medium" data-testid="quadrant">{suggestion.quadrant}</p>
		{:else}
			<p class="text-sm text-muted">{t('stateCheckin.waitingHint')}</p>
		{/if}
	</div>
	<label for={attributes.id} class="text-sm font-medium">
		{config.title}{#if config.required}<span aria-hidden="true"> *</span>{/if}
	</label>
	{#if suggestion}
		<p class="text-xs text-muted">{t('stateCheckin.wordsHint')}</p>
		<div
			class="flex flex-wrap gap-2"
			role="group"
			aria-label={t('stateCheckin.words')}
			data-testid="words"
		>
			{#each suggestion.words as word (word)}
				<Button
					disabled={attributes.disabled || config.schema.readOnly === true}
					pressed={value === word}
					onclick={() => choose(word)}>{word}</Button
				>
			{/each}
		</div>
	{/if}
	<TextInput {...rest} {config} {handlers} bind:value />
</div>
