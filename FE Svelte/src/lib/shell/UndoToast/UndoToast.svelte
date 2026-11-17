<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { UndoState } from '$lib/state/Undo/Undo.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	let { undo }: { undo: UndoState } = $props();
	const elevate: Attachment<HTMLElement> = (element) => {
		const mobile = window.matchMedia('(max-width: 800px)');
		const update = () => {
			if (mobile.matches) {
				if (element.matches(':popover-open')) element.hidePopover();
				element.setAttribute('popover', 'manual');
				element.showPopover();
			} else {
				if (element.matches(':popover-open')) element.hidePopover();
				element.removeAttribute('popover');
			}
		};
		update();
		window.addEventListener('mobile-sheet-change', update);
		mobile.addEventListener('change', update);
		return () => {
			window.removeEventListener('mobile-sheet-change', update);
			mobile.removeEventListener('change', update);
		};
	};
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
		{@attach elevate}
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

<style>
	@media (max-width: 800px) {
		[data-testid='undo-toast']:popover-open {
			inset: auto auto 16px 50%;
			margin: 0;
			width: max-content;
			max-width: calc(100vw - 16px);
			bottom: max(16px, calc(100dvh - var(--mobile-sheet-top, 100dvh) + 8px));
		}
	}
</style>
