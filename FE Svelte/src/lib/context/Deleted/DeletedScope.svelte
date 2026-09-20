<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { untrack } from 'svelte';
	import { GROUP_HEADING_CLASS } from '$lib/context/constants';
	import { writeThenRead } from '$lib/context/write';
	import { contextWork } from '$lib/context/pending';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { DeletedScopesReader } from '$lib/state/Records/DeletedScopes.svelte';
	import { tempienceRepository } from '$lib/state/triplit';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { reloadForSaved } from '$lib/state/Workbench/open';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { DOT_HEADING_PX, ScopeDot } from '$lib/ui/ScopeDot';

	let { workbench, scopeId }: { workbench: WorkbenchState; scopeId: string } = $props();
	/** The deleted Scopes, read live; this panel shows the one that is selected. */
	const deleted = new DeletedScopesReader(tempienceRepository);
	$effect(() => {
		untrack(() => void deleted.load());
		return untrack(() => deleted.watch());
	});
	const entry = $derived(deleted.records.find((item) => item.scope.id === scopeId) ?? null);
	const presence = $derived(
		deleted.error ? 'error' : deleted.loading && !entry ? 'reading' : entry ? 'deleted' : 'absent'
	);
	let busy = $state(false);
	/** The repository accepted the return: the Scope is back, and nothing writes it again. */
	let committed = $state(false);
	let refusal = $state.raw<unknown>(null);
	let readFailure = $state.raw<unknown>(null);
	const read = (): Promise<void> => reloadForSaved(workbench, loadWorkbenchSnapshot);
	/**
	 * Bringing the Scope back is an ordinary later action with its own cause, not the inverse of
	 * the deletion: it returns the memberships that still carry this deletion's stamp and nothing
	 * else. Once the timeline has been read again the ordinary Scope panel takes this one's place.
	 */
	const restore = async (): Promise<void> => {
		if (busy || committed) return;
		busy = true;
		refusal = null;
		const outcome = await writeThenRead(
			() => tempienceRepository.setScopeDeleted(scopeId, false, 'user').then(() => {}),
			read,
			() => {
				committed = true;
			}
		);
		refusal = outcome.refusal;
		readFailure = outcome.readFailure;
		busy = false;
	};
	/** Reads again what could not be shown; the return itself is never issued twice. */
	const retry = async (): Promise<void> => {
		if (busy || !committed) return;
		busy = true;
		try {
			await contextWork.hold(read());
			readFailure = null;
		} catch (cause) {
			readFailure = cause ?? new Error();
		} finally {
			busy = false;
		}
	};
</script>

<!-- A Scope that is not on the timeline any more, read as it stands: what it was, what a return
     would bring back with it, and the one way back. -->
<section class="flex flex-col gap-3" data-testid="deleted-scope" data-scope={scopeId}>
	<div class="grid gap-1">
		<span class="font-mono text-xs text-muted">Scope</span>
		<div class="flex items-center gap-2">
			<ScopeDot
				colorHue={entry?.scope.colorHue ?? null}
				colorChroma={entry?.scope.colorChroma ?? null}
				colorDepth={entry?.scope.colorDepth ?? null}
				size={DOT_HEADING_PX}
				testId="scope-colour-dot"
			/>
			<h2 class="text-lg leading-snug font-semibold break-words" data-testid="selected-title">
				{entry?.scope.name ?? t('scope.unnamed')}
			</h2>
		</div>
		{#if deleted.error}
			<p
				role="alert"
				class="text-sm text-[color:var(--cg-danger)]"
				data-testid="deleted-scope-error"
			>
				{t('link.readFailed', { message: deleted.error })}
				<Button size="sm" variant="quiet" onclick={() => void deleted.load()}
					>{t('kind.retryLoad')}</Button
				>
			</p>
		{:else}
			<p
				class="text-sm text-[color:var(--cg-danger)]"
				role="status"
				data-testid="deleted-scope-state"
				data-state={presence}
			>
				{presence === 'reading'
					? t('scope.reading')
					: presence === 'absent'
						? t('scope.unavailable')
						: t('scope.deletedState')}
			</p>
		{/if}
		{#if entry?.scope.note}<p class="text-sm whitespace-pre-wrap">{entry.scope.note}</p>{/if}
	</div>
	{#if entry}
		<div class="flex flex-col gap-1 border-t border-outline pt-3">
			<h3 class={GROUP_HEADING_CLASS}>{t('scope.returning')}</h3>
			<ul class="flex flex-col gap-1" data-testid="scope-returning">
				{#each entry.returning as kind (kind.id)}
					<li class="text-sm" data-testid="scope-returning-kind">{kind.name}</li>
				{:else}
					<li class="text-sm text-muted">{t('scope.returningNone')}</li>
				{/each}
			</ul>
			<p class="text-sm text-muted" data-testid="scope-records-inside">
				{t('scope.recordsInside', { count: entry.records })}
			</p>
		</div>
	{/if}
	<div class="flex flex-wrap items-center gap-2">
		<Button
			size="sm"
			variant="primary"
			disabled={busy || committed || presence !== 'deleted'}
			data-testid="restore-scope"
			onclick={() => void restore()}>{t('scope.restore')}</Button
		>
		{#if refusal}
			<span
				role="alert"
				class="text-sm text-[color:var(--cg-danger)]"
				data-testid="restore-scope-error"
				>{t('scope.restoreFailed', { message: errorText(refusal) })}</span
			>
		{/if}
		{#if committed && readFailure !== null}
			<span
				role="alert"
				class="text-sm text-[color:var(--cg-danger)]"
				data-testid="restore-scope-not-shown"
				>{t('scope.restoredNotShown', { message: errorText(readFailure) })}
				<Button size="sm" variant="quiet" disabled={busy} onclick={() => void retry()}
					>{t('kind.retryLoad')}</Button
				></span
			>
		{/if}
	</div>
</section>
