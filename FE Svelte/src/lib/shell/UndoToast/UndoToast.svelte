<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { UndoState } from '$lib/state/Undo/Undo.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	let { undo }: { undo: UndoState } = $props();
	/** A refusal of the inverse is the user's to read: it changed nothing. */
	const failure = $derived(
		undo.failure === null
			? ''
			: undo.failure === 'space'
				? t('undo.otherSpace')
				: errorText(undo.failure)
	);
	/** The offer names its action in the language of the moment when it can. */
	const label = $derived(
		undo.pending
			? typeof undo.pending.label === 'function'
				? undo.pending.label()
				: undo.pending.label
			: ''
	);
	/**
	 * Once the inverse has committed, the action is taken back for good and the only thing left
	 * to ask for is the reading; before that, asking again attempts the inverse itself.
	 */
	const message = $derived(
		!failure
			? ''
			: undo.inverted
				? t('undo.notShown', { message: failure })
				: t('undo.failed', { message: failure })
	);
	const action = $derived(
		undo.busy ? t('undo.running') : undo.inverted ? t('kind.retryLoad') : t('undo.undo')
	);
</script>

<!-- DP23: the action is done; this is the one chance to take it back before it fades. -->
{#if undo.pending}
	<div
		class="cg-popover fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 border border-outline bg-raised px-3 py-2 text-sm text-ink shadow-md"
		role="status"
		data-testid="undo-toast"
	>
		<span>{label}</span>
		{#if message}
			<span
				class={undo.inverted ? 'text-muted' : 'text-[color:var(--cg-danger)]'}
				role={undo.inverted ? 'status' : 'alert'}
				data-testid="undo-error"
				data-inverted={undo.inverted ? 'true' : undefined}>{message}</span
			>
		{/if}
		<Button size="sm" disabled={undo.busy} data-testid="undo" onclick={() => void undo.undo()}
			>{action}</Button
		>
		<Button
			size="sm"
			variant="quiet"
			icon
			disabled={undo.busy}
			aria-label={t('common.close')}
			onclick={() => undo.dismiss()}>×</Button
		>
	</div>
{/if}
