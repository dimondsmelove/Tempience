<script lang="ts" module>
	declare module '@sjsf/form' {
		interface ComponentProps {
			dateTimeWidget: ComponentProps['textWidget'];
		}
		interface ComponentBindings {
			dateTimeWidget: 'value';
		}
	}
</script>

<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { getFormContext, inputAttributes, type ComponentProps } from '@sjsf/form';
	import TextInput from '@sjsf/basic-theme/widgets/text.svelte';
	import DateInput from '$lib/ui/DateInput/DateInput.svelte';
	import { localDateValue } from '$lib/ui/DateInput/DateInput';
	let {
		value = $bindable(),
		config,
		handlers,
		...rest
	}: ComponentProps['dateTimeWidget'] = $props();
	const context = getFormContext();
	const attributes = $derived(
		inputAttributes(context, config, 'text', handlers, { type: 'datetime-local' })
	);
	const withTime = $derived(config.schema.format === 'date-time');
	const localValue = $derived.by(() => {
		if (!withTime) return value ?? '';
		if (!value) return '';
		const date = new Date(value);
		return Number.isFinite(date.getTime()) ? localDateValue(date, true) : '';
	});
</script>

{#if config.schema.format === 'date' || withTime}
	<DateInput
		{...attributes}
		type={withTime ? 'datetime-local' : 'date'}
		calendarLabel={t('time.calendarFor', { name: config.schema.title ?? t('time.date') })}
		bind:value={
			() => localValue,
			(input) => (value = input ? (withTime ? new Date(input).toISOString() : input) : undefined)
		}
	/>
{:else}
	<TextInput {...rest} bind:value {config} {handlers} />
{/if}
