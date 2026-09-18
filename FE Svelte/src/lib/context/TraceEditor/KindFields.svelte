<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';

	let { draft }: { draft: TraceDraftState } = $props();
	/** An entry that fixed the version («Записать» from a Kind) shows no switch, like a saved record. */
	const switchable = $derived(draft.entry.mode === 'create' && !draft.entry.versionId);
	const versionIssue = $derived(draft.issueFor('version'));
	const scoped = $derived(draft.scopedKinds);
	const others = $derived(draft.kinds.filter((entry) => !scoped.includes(entry)));
	const created = $derived(
		draft.createdKind && draft.createdKind.id !== draft.kindId ? draft.createdKind : null
	);
</script>

{#snippet options(entries: typeof draft.kinds)}
	{#each entries as entry (entry.id)}
		<option value={entry.id}>{entry.name}</option>
	{/each}
{/snippet}

<!-- The record's Trace Kind: the picker and its «+» on one line; a Kind fixed by the entry shows no switch. -->
{#if switchable}
	<div class="grid gap-2" data-testid="draft-kind">
		<div class="grid gap-1 text-sm">
			<span>{t('draft.kind')}</span>
			<div class="flex items-center gap-1">
				<select
					class="cg-control cg-field min-w-0 flex-1"
					aria-label={t('draft.kind')}
					value={draft.kindId}
					onchange={(event) => draft.chooseKind(event.currentTarget.value)}
				>
					<option value="">{t('draft.kindPlain')}</option>
					{#if scoped.length}
						<optgroup label={t('draft.kindsOfScopes')}>{@render options(scoped)}</optgroup>
						<optgroup label={t('draft.kindsOther')}>{@render options(others)}</optgroup>
					{:else}
						{@render options(draft.kinds)}
					{/if}
				</select>
				<Button
					icon
					aria-label={t('draft.kindNew')}
					title={t('draft.kindNew')}
					data-testid="draft-kind-new"
					onclick={() => (draft.nested = 'kind')}><PlusOutline class="h-4 w-4" /></Button
				>
			</div>
			{#if created}<span class="text-xs text-muted" role="status" data-testid="kind-created"
					>{t('draft.kindCreated', { name: created.name })}</span
				>{/if}
		</div>
		{#if draft.typed && draft.kindVersions.length > 1}
			<label class="grid gap-1 text-sm"
				>{t('draft.version')}
				<select
					class="cg-control cg-field"
					value={draft.versionId}
					aria-invalid={versionIssue ? 'true' : undefined}
					onchange={(event) => draft.chooseVersion(event.currentTarget.value)}
					onblur={() => draft.touch('version')}
				>
					<option value="" disabled>{t('draft.versionChoose')}</option>
					{#each draft.kindVersions as entry (entry.id)}
						<option value={entry.id}
							>{t('draft.versionLabel', {
								generation: entry.generation,
								id: entry.id.slice(-6)
							})}</option
						>
					{/each}
				</select>
			</label>
		{/if}
	</div>
{:else if draft.version}
	<p class="text-sm text-muted" data-testid="pinned-version">
		{t('draft.pinnedVersion', {
			kind: draft.kind?.name ?? String(draft.version.dataSchema.title ?? ''),
			generation: draft.version.generation
		})}
	</p>
{/if}
