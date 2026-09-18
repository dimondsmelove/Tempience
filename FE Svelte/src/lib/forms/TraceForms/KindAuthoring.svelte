<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { NestedSave } from '$lib/state/TraceDraft/nested.svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { Scope, TraceKind, TraceKindV, TraceKindVDraft } from '$lib/state/triplit/types';
	import type { TraceFormDraft } from '$lib/model/TraceForm/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import Builder from './Builder.svelte';
	import type { KindSaveResult } from './kind-save';
	import type { KindMembershipsLoader } from './memberships.svelte';
	import { runKindSave } from './nested-kind';
	import type { MembershipIntent } from './types';

	let {
		kind,
		published,
		initial,
		scopes,
		compact = false,
		memberships,
		newScopes,
		onsaved
	}: {
		kind?: TraceKind;
		published?: TraceKindV;
		initial: TraceFormDraft;
		scopes: readonly Scope[];
		compact?: boolean;
		memberships: KindMembershipsLoader;
		/** A new Kind's first memberships — the Scope it was asked from — shown and changeable. */
		newScopes?: readonly string[];
		/** What the catalog does with the committed result; a rejection is a failed return, repeatable. */
		onsaved: (result: KindSaveResult) => void | Promise<void>;
	} = $props();
	// The write is latched the moment the repository returns; a second click never writes again.
	const saving = new NestedSave<KindSaveResult>();
	/** An existing Kind edits its current memberships, read once they are known; a new Kind starts with what it was asked from, or empty. */
	const current = $derived(kind ? memberships.for(kind.id) : (newScopes ?? []));
	const save = async (
		name: string,
		definition: TraceKindVDraft,
		intent: MembershipIntent
	): Promise<void> => {
		await runKindSave(
			saving,
			repository,
			{ kind, published, name, definition, memberships: intent },
			onsaved
		);
		// A refused write is the Builder's own message; every value stays for the next attempt.
		if (saving.failure?.stage === 'write') throw saving.failure.cause;
	};
</script>

{#if saving.failure?.stage === 'return'}
	<p role="alert" class="text-sm" data-testid="kind-saved-not-shown">
		{t('kind.savedNotShown', { message: errorText(saving.failure.cause) })}
	</p>
	<Button
		variant="primary"
		class="justify-self-start"
		data-testid="kind-retry-return"
		onclick={() => void saving.retry()}>{t('nested.retryReturn')}</Button
	>
{:else if kind && memberships.error}
	<p role="alert" class="text-sm" data-testid="kind-scopes-failed">
		{t('kind.scopesLoadFailed', { message: memberships.error })}
	</p>
	<Button
		class="justify-self-start"
		data-testid="kind-scopes-retry"
		onclick={() => void memberships.load(kind?.id)}>{t('kind.retryLoad')}</Button
	>
{:else if current === null}
	<p class="text-sm text-muted" data-testid="kind-scopes-loading">{t('kind.scopesLoading')}</p>
{:else}
	<Builder {compact} {initial} {published} {scopes} memberships={current} onsave={save} />
{/if}
