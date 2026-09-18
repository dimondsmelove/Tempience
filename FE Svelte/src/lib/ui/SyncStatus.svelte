<script lang="ts">
	import { resolve } from '$app/paths';
	import BackupImport from './BackupImport/BackupImport.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { dateTimeFormat, numberFormat } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { MessageKey } from '$lib/state/Locale/types';
	import { pwa } from '$lib/state/Pwa/Pwa.svelte';
	import { getTriplitServerUrl } from '$lib/state/triplit/auth';
	import { dataSpaceBackup } from '$lib/state/triplit';
	import { activeDataSpace, triplit } from '$lib/state/triplit/client';
	import { syncStatus } from '$lib/state/triplit/sync-status-instance';
	import {
		getSyncDiagnostics,
		type SyncCollectionName,
		type SyncConnectionStatus,
		type SyncDiagnosticsSnapshot
	} from '$lib/state/triplit/sync-status';

	let { quiet = false }: { quiet?: boolean } = $props();

	/** The store keeps what the transport said, or a code of its own; the words are the interface's. */
	const syncErrorText = (error: string): string =>
		error === 'sync_error'
			? t('sync.errorGeneric')
			: error === 'sync_send_failed'
				? t('sync.sendFailed')
				: error === 'server_unavailable'
					? t('sync.serverUnavailable')
					: error.startsWith('session:')
						? t('sync.session', { type: error.slice('session:'.length) })
						: t('sync.errorDetail', { message: error });

	const syncConfigured = activeDataSpace.syncEnabled && Boolean(getTriplitServerUrl());

	const CONNECTION_KEYS: Record<SyncConnectionStatus, MessageKey> = {
		'local-only': 'sync.localOnly',
		unpaired: 'sync.unpaired',
		connecting: 'sync.connecting',
		online: 'sync.online',
		offline: 'sync.offline',
		error: 'sync.error'
	};
	const COMPACT_KEYS: Record<SyncConnectionStatus, MessageKey> = {
		'local-only': 'sync.localOnlyShort',
		unpaired: 'sync.unpaired',
		connecting: 'sync.connectingShort',
		online: 'sync.onlineShort',
		offline: 'sync.offline',
		error: 'sync.errorShort'
	};

	const connectionClasses: Record<SyncConnectionStatus, string> = {
		'local-only': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
		unpaired: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
		connecting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
		online: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
		offline: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
		error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
	};

	const COLLECTION_KEYS: ReadonlyArray<{ key: SyncCollectionName; label: MessageKey }> = [
		{ key: 'traceKinds', label: 'sync.collectionKinds' },
		{ key: 'traceKindVersions', label: 'sync.collectionVersions' },
		{ key: 'traces', label: 'sync.collectionTraces' },
		{ key: 'periods', label: 'sync.collectionPeriods' },
		{ key: 'scopes', label: 'sync.collectionScopes' },
		{ key: 'intersections', label: 'sync.collectionLinks' },
		{ key: 'logs', label: 'sync.collectionLogs' }
	];

	let exporting = $state(false);
	let exportFailure = $state.raw<unknown>(null);
	const exportData = async (): Promise<void> => {
		exporting = true;
		exportFailure = null;
		try {
			const backup = await dataSpaceBackup.export();
			const url = URL.createObjectURL(
				new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
			);
			const link = document.createElement('a');
			link.href = url;
			link.download = `tempience-${backup.dataSpace.id}-${backup.exportedAt.slice(0, 10)}.json`;
			document.body.append(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (cause) {
			exportFailure = cause ?? new Error();
		} finally {
			exporting = false;
		}
	};

	let diagnosticsOpen = $state(false);
	let diagnosticsLoading = $state(false);
	let diagnostics = $state<SyncDiagnosticsSnapshot | null>(null);
	let diagnosticsFailure = $state.raw<unknown>(null);

	const formatTimestamp = (value: string | null): string => {
		if (!value) return '';
		try {
			return dateTimeFormat(locale.current, { timeStyle: 'short' }).format(new Date(value));
		} catch {
			return value;
		}
	};
	const megabytes = (bytes: number): string =>
		numberFormat(locale.current, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024);

	const refreshDiagnostics = async (): Promise<void> => {
		diagnosticsLoading = true;
		void pwa.refreshStorage();
		diagnosticsFailure = null;
		try {
			diagnostics = await getSyncDiagnostics(triplit, {
				syncEnabled: syncConfigured
			});
		} catch (cause: unknown) {
			diagnosticsFailure = cause ?? new Error();
		} finally {
			diagnosticsLoading = false;
		}
	};

	const toggleDiagnostics = (): void => {
		diagnosticsOpen = !diagnosticsOpen;
		if (diagnosticsOpen) void refreshDiagnostics();
	};
</script>

<div
	class="sync-widget relative z-50 flex min-w-0 items-center gap-1.5 text-xs"
	title={$syncStatus.error ? syncErrorText($syncStatus.error) : undefined}
>
	<div class="flex min-w-0 items-center gap-1.5">
		{#if quiet}
			<button
				type="button"
				class="sync-quiet inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-muted"
				data-sync-state={$syncStatus.connection}
				aria-label={t('sync.state', { state: t(CONNECTION_KEYS[$syncStatus.connection]) })}
				aria-expanded={diagnosticsOpen}
				onclick={toggleDiagnostics}
			>
				<span aria-hidden="true" class="h-1.5 w-1.5 shrink-0 rounded-full bg-current"></span>
				<span class="truncate">{t(CONNECTION_KEYS[$syncStatus.connection])}</span>
			</button>
		{:else}
			<span
				data-sync-state={$syncStatus.connection}
				title={t(CONNECTION_KEYS[$syncStatus.connection])}
				aria-label={t(CONNECTION_KEYS[$syncStatus.connection])}
				class={`sync-badge whitespace-nowrap rounded-full px-1 py-1 text-[0.625rem] font-medium sm:px-2 sm:text-xs ${connectionClasses[$syncStatus.connection]}`}
			>
				<span class="sm:hidden">{t(COMPACT_KEYS[$syncStatus.connection])}</span>
				<span class="hidden sm:inline">{t(CONNECTION_KEYS[$syncStatus.connection])}</span>
			</span>
		{/if}
		{#if $syncStatus.pending > 0}
			<span class="sync-pending whitespace-nowrap text-amber-700 dark:text-amber-300">
				{t('sync.pending', { count: $syncStatus.pending })}
			</span>
		{/if}
		{#if !quiet && $syncStatus.lastSyncedAt}
			<span class="sync-muted hidden whitespace-nowrap text-gray-500 sm:inline">
				{t('sync.last', { time: formatTimestamp($syncStatus.lastSyncedAt) })}
			</span>
		{/if}
	</div>

	{#if !quiet}
		<button
			type="button"
			class="sync-trigger h-11 w-11 shrink-0 rounded px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100"
			aria-label={t('sync.details')}
			aria-expanded={diagnosticsOpen}
			title={t('sync.details')}
			onclick={toggleDiagnostics}
		>
			ⓘ
		</button>
	{/if}

	{#if diagnosticsOpen}
		<div
			class="cg-popover fixed right-2 top-[3.5rem] z-50 w-[calc(100vw-1rem)] max-w-80 max-h-[calc(100dvh-5rem)] overflow-y-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
			role="status"
		>
			<div class="mb-2 flex items-center justify-between gap-3">
				<strong>{syncConfigured ? t('sync.diagnostics') : t('sync.localData')}</strong>
				<button
					type="button"
					class="text-teal-700 hover:underline disabled:opacity-50 dark:text-teal-300"
					disabled={diagnosticsLoading}
					onclick={() => void refreshDiagnostics()}
				>
					{diagnosticsLoading ? t('sync.refreshing') : t('sync.refresh')}
				</button>
			</div>

			{#if !syncConfigured}<p class="mb-3">{t('sync.notConfigured')}</p>{/if}
			<a
				href={resolve('/pair')}
				class="cg-control cg-control-sm mb-3 inline-flex items-center"
				title={t('sync.pairTitle')}
				onclick={() => (diagnosticsOpen = false)}>{t('sync.pair')}</a
			>

			{#if diagnosticsFailure !== null}
				<p class="sync-error text-red-700 dark:text-red-300">{errorText(diagnosticsFailure)}</p>
			{:else if diagnostics}
				<div class="space-y-1.5">
					{#each COLLECTION_KEYS as item (item.key)}
						{@const collection = diagnostics.collections[item.key]}
						<div class="flex items-center justify-between gap-2">
							<span>{t(item.label)}</span>
							<span class="sync-muted whitespace-nowrap text-gray-500 dark:text-gray-400">
								{#if syncConfigured}
									{t('sync.countsBoth', {
										local: collection.local,
										server: collection.server ?? '—'
									})}
								{:else}
									{t('sync.countsLocal', { local: collection.local })}
								{/if}
							</span>
						</div>
					{/each}
				</div>
				<div class="mt-3 space-y-1 border-t border-gray-200 pt-2 dark:border-gray-700">
					{#if syncConfigured}<div>{t('sync.outbox', { count: diagnostics.pending })}</div>{/if}
					<div>{t('sync.checkedAt', { time: formatTimestamp(diagnostics.checkedAt) })}</div>
					{#if diagnostics.serverError}
						<div class="sync-error text-red-700 dark:text-red-300">
							{t('sync.server', { message: syncErrorText(diagnostics.serverError) })}
						</div>
					{/if}
				</div>
			{:else}
				<p>{t('sync.collecting')}</p>
			{/if}
			<div class="mt-3 space-y-2 border-t border-outline pt-2">
				<button
					type="button"
					class="cg-control cg-control-sm"
					disabled={exporting}
					onclick={() => void exportData()}
				>
					{exporting ? t('backup.preparing') : t('backup.export')}
				</button>
				{#if exportFailure !== null}<p role="alert">{errorText(exportFailure)}</p>{/if}
				<BackupImport />
				{#if pwa.storage.usage !== null}
					<p>{t('sync.onDevice', { size: megabytes(pwa.storage.usage) })}</p>
				{/if}
				{#if pwa.storage.persistent === true}<p>{t('sync.persistent')}</p>{/if}
				<button
					type="button"
					class="cg-control cg-control-sm"
					disabled={pwa.checking}
					onclick={() => void pwa.check()}
				>
					{pwa.checking ? t('pwa.checking') : t('pwa.check')}
				</button>
				{#if pwa.notice}<p>{t(pwa.notice)}</p>{/if}
				{#if pwa.error}<p role="alert">{t(pwa.error)}</p>{/if}
			</div>
		</div>
	{/if}
</div>
