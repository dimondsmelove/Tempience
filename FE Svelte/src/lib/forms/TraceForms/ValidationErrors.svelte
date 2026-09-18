<script lang="ts" module>
	import '@sjsf/form/fields/extra-components/errors-list';
</script>

<script lang="ts">
	import { errorsListAttributes, getFormContext, type ComponentProps } from '@sjsf/form';
	import { validationText } from './validation';

	// The theme's errors list, reading each message's words in the language of the moment; a
	// missing field is named here, from this list's own configuration, never from the message.
	const { errors, config }: ComponentProps['errorsList'] = $props();
	const ctx = getFormContext();
</script>

<ul {...errorsListAttributes(ctx, config, 'errorsList', { class: 'sjsf-errors-list' })}>
	{#each errors as message, index (index)}
		<li>{validationText(message, config)}</li>
	{/each}
</ul>
