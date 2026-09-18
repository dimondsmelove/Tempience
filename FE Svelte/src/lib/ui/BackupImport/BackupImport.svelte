<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { CodedError } from '$lib/model/Errors/CodedError';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import {
		dataSpaceLabel,
		saveActiveDataSpaceId,
		type DataSpace
	} from '$lib/state/triplit/data-space';
	import { importDataSpaceBackup } from '$lib/state/triplit/Backup/import';
	import { parseDataSpaceBackup } from '$lib/state/triplit/Backup/parse';
	import type { DataSpaceBackup } from '$lib/state/triplit/Backup/types';
	import { MAX_BACKUP_BYTES } from './constants';
	import type { BackupImportStatus } from './types';

	let status = $state<BackupImportStatus>('idle');
	let backup = $state.raw<DataSpaceBackup | null>(null);
	let created = $state.raw<DataSpace | null>(null);
	/** The failure of the last step, read in the language of the moment. */
	let failure = $state.raw<unknown>(null);
	const busy = $derived(status !== 'idle');
	/** A saved database that could not be opened: the failure is named around that fact. */
	let openFailure = $state(false);

	const chooseFile = async (event: Event): Promise<void> => {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		backup = null;
		created = null;
		failure = null;
		openFailure = false;
		if (!file) return;
		if (file.size > MAX_BACKUP_BYTES) {
			failure = new CodedError('backup_too_large', 'backup over the import cap', {
				megabytes: Math.round(MAX_BACKUP_BYTES / 1024 / 1024)
			});
			return;
		}
		status = 'reading';
		try {
			backup = parseDataSpaceBackup(JSON.parse(await file.text()));
		} catch (cause) {
			failure =
				cause instanceof SyntaxError
					? new CodedError('backup_not_json', cause.message)
					: (cause ?? new Error());
		} finally {
			status = 'idle';
		}
	};

	/**
	 * Opening the restored database reloads the app: a changed open form and input kept only
	 * in memory both ask first. Refusing leaves the imported space exactly as it is — it was
	 * created by a command that already succeeded, and can be opened later without importing
	 * anything again.
	 */
	const openCreated = (): void => {
		const target = created;
		if (!target) return;
		draftGuard.exitReloading(() => {
			try {
				saveActiveDataSpaceId(target.id);
				window.location.reload();
			} catch (cause) {
				openFailure = true;
				failure = cause ?? new Error();
			}
		});
	};

	const restore = async (): Promise<void> => {
		if (!backup || busy || created) return;
		status = 'restoring';
		failure = null;
		openFailure = false;
		try {
			created = await importDataSpaceBackup(backup);
			openCreated();
		} catch (cause) {
			openFailure = created !== null;
			failure = cause ?? new Error();
		} finally {
			status = 'idle';
		}
	};
</script>

<section class="space-y-2 border-t border-outline pt-3" aria-label={t('backup.importTitle')}>
	<label class="block space-y-2">
		<span class="font-semibold">{t('backup.load')}</span>
		<input
			class="cg-field w-full min-w-0 text-xs"
			type="file"
			accept=".json,application/json"
			aria-label={t('backup.file')}
			disabled={busy}
			onchange={(event) => void chooseFile(event)}
		/>
	</label>
	{#if status === 'reading'}
		<p role="status">{t('backup.checking')}</p>
	{:else if created}
		<p>{t('backup.saved', { label: dataSpaceLabel(created, t) })}</p>
		<Button size="sm" onclick={openCreated}>{t('backup.open')}</Button>
	{:else if backup}
		<div class="space-y-2 rounded border border-outline p-2" data-testid="backup-import-preview">
			<p class="font-semibold">{backup.dataSpace.label}</p>
			<p>
				{t('backup.contents', {
					records: t('common.records', { count: backup.collections.traces.length }),
					scopes: t('backup.groups', { count: backup.collections.scopes.length })
				})}
			</p>
			<p>{t('backup.separate')}</p>
			<Button size="sm" variant="primary" disabled={busy} onclick={() => void restore()}>
				{status === 'restoring' ? t('backup.restoring') : t('backup.create')}
			</Button>
		</div>
	{:else}
		<p class="text-muted">{t('backup.hint')}</p>
	{/if}
	{#if failure !== null}<p role="alert">
			{openFailure
				? t('backup.savedNotOpened', { message: errorText(failure) })
				: errorText(failure)}
		</p>{/if}
</section>
