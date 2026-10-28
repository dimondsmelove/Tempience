<script lang="ts" module>
	declare module '@sjsf/form' {
		interface ComponentProps {
			stateScaleWidget: ComponentProps['numberWidget'];
		}
		interface ComponentBindings {
			stateScaleWidget: 'value';
		}
	}
</script>

<script lang="ts">
	import { getFormContext, inputAttributes, type ComponentProps } from '@sjsf/form';
	import { SCALE } from '$lib/model/StateCheckin/constants';

	let { value = $bindable(), config, handlers }: ComponentProps['stateScaleWidget'] = $props();
	const context = getFormContext();
	const attributes = $derived(inputAttributes(context, config, 'number', handlers, {}));
</script>

<div
	class="grid grid-cols-5 gap-2"
	role="radiogroup"
	aria-label={config.title}
	aria-required={config.required}
	data-testid="state-scale"
>
	{#each SCALE as rating (rating)}
		<label class="relative cursor-pointer">
			<input
				{...attributes}
				type="radio"
				id={rating === 1 ? attributes.id : `${attributes.id}-${rating}`}
				value={rating}
				bind:group={value}
				disabled={attributes.disabled || config.schema.readOnly === true}
				class="peer sr-only"
			/>
			<span
				class="flex min-h-11 items-center justify-center rounded-[var(--cg-radius-control)] border border-outline bg-raised font-medium transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-default peer-disabled:opacity-50"
				>{rating}</span
			>
		</label>
	{/each}
</div>
