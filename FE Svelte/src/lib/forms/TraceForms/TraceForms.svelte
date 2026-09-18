<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { goto } from '$app/navigation';
	import Button from '$lib/ui/Button/Button.svelte';
	import { dateTimeFormat } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { MessageKey } from '$lib/state/Locale/types';
	import { tempienceRepository as repository, findTraceKindVersionHeads } from '$lib/state/triplit';
	import type { Scope, TraceKind, TraceKindV } from '$lib/state/triplit/types';
	import { decodeTraceForm, newTraceField } from '$lib/model/TraceForm/TraceForm';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import KindHistory from '$lib/forms/TraceDataset/KindHistory.svelte';
	import { KindHistoryState } from '$lib/state/KindHistory/KindHistory.svelte';
	import { FILL_KEY, FORM_TABS } from './constants';
	import KindAuthoring from './KindAuthoring.svelte';
	import type { KindSaveResult } from './kind-save';
	import { KindMembershipsLoader } from './memberships.svelte';

	let {
		kindId = $bindable(),
		newKindScopes,
		ondata,
		oncapture,
		standalone
	}: {
		kindId?: string;
		/** Given when the catalog opens to make a Kind: the memberships the new Kind starts with. */
		newKindScopes?: readonly string[];
		ondata?: (kindId: string, versionId: string) => void;
		oncapture?: (kindId: string, versionId: string) => void;
		/**
		 * The standalone page's own addresses — its Kind pages and its catalog — given by that
		 * page: they are owner routes, which the public profile's route table does not have.
		 */
		standalone?: { kindHref: (kindId: string) => ResolvedPathname; allHref: ResolvedPathname };
	} = $props();
	const embedded = $derived(Boolean(ondata));
	/** The standalone page's own history of the Kind shown; the workbench keeps its own. */
	const history = $derived(kindId && !ondata ? new KindHistoryState(kindId) : null);
	let query = $state('');
	let kinds = $state.raw<TraceKind[]>([]);
	const filteredKinds = $derived(
		kinds.filter((entry) =>
			entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
		)
	);
	function chooseKind(id?: string) {
		kindId = id;
		selectedVersionId = '';
		creating = false;
		tab = 'overview';
		message = '';
		void memberships.load(id);
	}
	let versions = $state.raw<TraceKindV[]>([]);
	let scopes = $state.raw<Scope[]>([]);
	/** The selected Kind's direct memberships, read in order when it is chosen and after each save. */
	const memberships = new KindMembershipsLoader(repository);
	let selectedVersionId = $state('');
	let creating = $state(untrack(() => Boolean(newKindScopes)));
	let loading = $state(true);
	/** The cause of a failed subscription, or null; read through the boundary where shown. */
	let failure = $state.raw<unknown>(null);
	/** What the catalog says after a save, as a key of the catalogs. */
	let message = $state<MessageKey | ''>('');
	// The standalone page opens on the Kind's table; the embedded catalog on its overview.
	let tab = $state<(typeof FORM_TABS)[number]['id'] | 'overview'>(
		untrack(() => ondata) ? 'overview' : 'table'
	);
	/**
	 * Trace authoring belongs to the workbench: the Kind's table stays in the centre and the form
	 * opens on the right, so a save shows the record in the Context without moving the view
	 * (TRACE_FORMS «результат сохранения»). Nothing of this page is read after the navigation.
	 */
	async function authorInWorkbench(then: () => void | Promise<void>): Promise<void> {
		if (!kind || !selected) return;
		const target = { kindId: kind.id, versionId: selected.id };
		await goto(resolve('/time'));
		workbench.forms.showData(target.kindId, target.versionId);
		await then();
	}
	const fill = () =>
		authorInWorkbench(() => {
			const data = workbench.forms.data;
			if (data) workbench.openCapture({ kindId: data.kindId, versionId: data.versionId });
		});
	/**
	 * A row of the table becomes the Context, where «Редактировать» opens the one edit form;
	 * the Context reads the record itself, and the workbench reads its timeline as it mounts.
	 */
	const openTrace = (id: string) => authorInWorkbench(() => workbench.selectTrace(id, 'context'));
	const kind = $derived(kinds.find((entry) => entry.id === kindId));
	const kindVersions = $derived(versions.filter((entry) => entry.kindId === kindId));
	const heads = $derived(findTraceKindVersionHeads(kindVersions));
	const effectiveVersionId = $derived(selectedVersionId || (heads.length === 1 ? heads[0].id : ''));
	const selected = $derived(kindVersions.find((entry) => entry.id === effectiveVersionId));
	const decoded = $derived.by(() => {
		if (!selected || !kind) return null;
		try {
			return { draft: decodeTraceForm(kind.name, selected), failure: null };
		} catch (cause) {
			return { draft: null, failure: cause ?? new Error() };
		}
	});
	onMount(() => {
		let kindsReady = false,
			versionsReady = false;
		const fail = (cause: unknown) => {
			failure = cause ?? new Error();
			loading = false;
		};
		void memberships.load(kindId);
		const subscriptions = [
			repository.subscribeScopes((rows) => {
				scopes = rows;
			}, fail),
			repository.subscribeTraceKinds((rows) => {
				kinds = rows;
				kindsReady = true;
				loading = !versionsReady;
			}, fail),
			repository.subscribeTraceKindVersions((rows) => {
				versions = rows;
				versionsReady = true;
				loading = !kindsReady;
			}, fail)
		];
		return () => subscriptions.forEach((unsubscribe) => unsubscribe());
	});
	/** What the catalog shows after a committed save; a failure here never writes again. */
	async function saved(result: KindSaveResult) {
		if (result.outcome === 'created') {
			if (embedded) {
				chooseKind(result.kindId);
				selectedVersionId = result.versionId;
				message = 'forms.created';
			} else if (standalone) await goto(standalone.kindHref(result.kindId));
			return;
		}
		await memberships.load(result.kindId);
		if (memberships.failure !== null) throw memberships.failure;
		if (result.outcome === 'versioned') {
			selectedVersionId = result.versionId;
			if (embedded) tab = 'overview';
			message = 'forms.versioned';
		} else if (result.outcome === 'edited') {
			if (embedded) tab = 'overview';
			message = result.scopeIds ? 'kind.saved' : 'kind.renamed';
		} else message = 'kind.nothingChanged';
	}
</script>

<div
	class={embedded ? 'min-w-0' : 'h-full overflow-auto p-[var(--cg-panel-padding)]'}
	data-testid="trace-forms"
>
	<div class="mx-auto max-w-6xl">
		<nav class="mb-4 flex flex-wrap gap-2 text-sm" aria-label={t('forms.nav')}>
			{#if embedded}
				<!-- A form on the page has its own «Отмена»; the way back to the list is for a Kind's page. -->
				{#if kindId && tab !== 'builder'}<Button size="sm" onclick={() => chooseKind()}
						>{t('forms.all')}</Button
					>{/if}
			{:else}
				<a class="underline" href={resolve('/time')}>{t('forms.timeline')}</a>
				{#if kindId && standalone}<a class="underline" href={standalone.allHref}>{t('forms.all')}</a
					>{/if}
			{/if}
		</nav>
		<h1 class="mb-4 text-xl font-semibold break-words">
			{kind?.name ?? (creating ? t('forms.newKind') : t('forms.catalog'))}
		</h1>
		{#if failure !== null}<p role="alert">{errorText(failure)}</p>{/if}
		{#if loading}<p class="text-muted">{t('forms.loading')}</p>
		{:else if kindId && !kind}<p role="alert">{t('forms.notFound')}</p>
		{:else if kind}
			<label class="mb-5 grid max-w-lg gap-1 text-sm"
				>{t('forms.version')}
				<select
					class="cg-control cg-field"
					value={effectiveVersionId}
					onchange={(event) => (selectedVersionId = event.currentTarget.value)}
				>
					<option value="" disabled>{t('forms.chooseVersion')}</option>
					{#each kindVersions as version (version.id)}<option value={version.id}
							>{t('forms.versionOption', {
								generation: version.generation,
								date: dateTimeFormat(locale.current, {
									dateStyle: 'short',
									timeStyle: 'short'
								}).format(new Date(version.createdAt)),
								id: version.id.slice(-6)
							})}</option
						>{/each}
				</select>
			</label>
			{#if !effectiveVersionId}<p class="mb-4 text-muted">
					{t('forms.branches')}
				</p>{/if}
			{#if message}<p class="mb-4 text-sm" role="status">{t(message)}</p>{/if}
			<!-- While the form is being edited its own buttons are the actions; the row waits. -->
			<div
				class={['mb-5 flex flex-wrap gap-2', embedded && tab === 'builder' && 'hidden']}
				role="group"
				aria-label={t('forms.actions')}
			>
				{#if embedded}
					<Button
						disabled={!selected}
						data-testid="kind-data"
						onclick={() => selected && ondata?.(kind!.id, selected.id)}>{t('forms.data')}</Button
					>
					<Button
						variant="primary"
						disabled={!selected}
						onclick={() => selected && oncapture?.(kind!.id, selected.id)}
						>{t('forms.record')}</Button
					>
					<Button disabled={!selected} onclick={() => (tab = 'builder')}
						>{t('forms.editForm')}</Button
					>
				{:else}
					<Button variant="primary" disabled={!selected} onclick={fill}>{t(FILL_KEY)}</Button>
					{#each FORM_TABS as entry (entry.id)}<Button
							variant={tab === entry.id ? 'primary' : 'default'}
							aria-pressed={tab === entry.id}
							onclick={() => (tab = entry.id)}>{t(entry.label)}</Button
						>{/each}
				{/if}
			</div>
			{#if selected}
				{#if tab === 'builder'}
					{#if decoded?.failure}<p role="alert">{errorText(decoded.failure)}</p>{/if}
					{#if decoded?.draft}{#key selected.id}<KindAuthoring
								{kind}
								published={selected}
								compact={embedded}
								initial={decoded.draft}
								{scopes}
								{memberships}
								onsaved={saved}
								oncancel={() => (tab = 'overview')}
							/>{/key}{/if}
				{:else if embedded}
					<p class="text-sm text-muted">
						{t('forms.fields', {
							fields: decoded?.draft?.fields.map((field) => field.label).join(', ') || '—'
						})}
					</p>
				{:else if history}{#key kind.id}<KindHistory
							{history}
							versions={kindVersions}
							onselect={openTrace}
						/>{/key}{/if}
			{/if}
		{:else}
			{#if !creating}<Button variant="primary" onclick={() => (creating = true)}
					>{t('forms.newKind')}</Button
				>{/if}
			{#if creating}<KindAuthoring
					compact={embedded}
					initial={{ name: '', fields: [newTraceField()] }}
					{scopes}
					{memberships}
					newScopes={newKindScopes}
					onsaved={saved}
					oncancel={() => (creating = false)}
				/>{:else}
				<label class="mt-5 grid gap-1 text-sm"
					>{t('forms.search')}<input
						type="search"
						class="cg-control cg-field"
						bind:value={query}
					/></label
				>
				<ul class="mt-2 grid gap-0.5">
					{#each filteredKinds as entry (entry.id)}<li>
							{#if embedded}<Button
									variant="quiet"
									class="w-full justify-start text-left break-words"
									onclick={() => chooseKind(entry.id)}>{entry.name}</Button
								>
							{:else if standalone}
								<a class="font-medium underline" href={standalone.kindHref(entry.id)}
									>{entry.name}</a
								>{/if}
						</li>{/each}
				</ul>
				{#if !filteredKinds.length}<p class="mt-3 text-sm text-muted">
						{query ? t('forms.nothingFound') : t('forms.empty')}
					</p>{/if}
			{/if}
		{/if}
	</div>
</div>
