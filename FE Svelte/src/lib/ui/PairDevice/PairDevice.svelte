<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { onMount } from 'svelte';
	import { CodedError } from '$lib/model/Errors/CodedError';
	import { errorText } from '$lib/state/Locale/errors';
	import { dateTimeFormat } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { MessageKey } from '$lib/state/Locale/types';
	import {
		clearStoredAuth,
		forgetServerUrl,
		getStoredAuth,
		getTriplitServerUrl,
		isServerUrlEditable,
		pairDevice,
		type DeviceAuth
	} from '$lib/state/triplit/auth';
	import { getDeviceId } from '$lib/state/triplit/ids';
	import { activeDataSpace, triplit } from '$lib/state/triplit/client';
	import { dataSpaceLabel } from '$lib/state/triplit/data-space';

	/** The address is the user's to set unless the build pins one (the owner's own build). */
	const editable = isServerUrlEditable();
	/** The address the client was created with; changing it needs a fresh client graph. */
	const bootServerUrl = getTriplitServerUrl();

	let serverUrl = $state(bootServerUrl ?? '');
	let code = $state('');
	let deviceLabel = $state('');
	let deviceId = $state('');
	let auth = $state<DeviceAuth | null>(null);
	let pairing = $state(false);
	/** The last failure, read in the language of the moment; the notice is a key of the catalogs. */
	let failure = $state.raw<unknown>(null);
	let notice = $state<MessageKey | null>(null);

	const canPair = $derived(
		!pairing &&
			code.trim().length > 0 &&
			(editable ? serverUrl.trim().length > 0 : Boolean(bootServerUrl))
	);

	onMount(() => {
		deviceId = getDeviceId();
		auth = getStoredAuth();
		deviceLabel = `Browser ${deviceId.slice(0, 8)}`;
	});

	const handlePair = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		if (!activeDataSpace.syncEnabled) return;
		pairing = true;
		failure = null;
		notice = null;
		try {
			const nextAuth = await pairDevice(code, deviceLabel, editable ? serverUrl : undefined);
			// A new address means the client, the sync store and the header were built without it:
			// reload so they all pick it up together, the same way a DataSpace switch does.
			if (getTriplitServerUrl() !== bootServerUrl) {
				location.reload();
				return;
			}
			await triplit.startSession(nextAuth.token);
			auth = nextAuth;
			code = '';
			notice = 'pair.paired';
		} catch (cause) {
			failure = cause ?? new CodedError('pairing', 'pairing failed');
		} finally {
			pairing = false;
		}
	};

	const handleUnpair = async (): Promise<void> => {
		if (!activeDataSpace.syncEnabled) return;
		await triplit.endSession();
		clearStoredAuth();
		if (editable) {
			// Back to local-only, exactly as before pairing.
			forgetServerUrl();
			location.reload();
			return;
		}
		auth = null;
		notice = 'pair.unpaired';
		failure = null;
	};

	const formatExpiry = (value: string): string => {
		try {
			return dateTimeFormat(locale.current, { dateStyle: 'medium', timeStyle: 'short' }).format(
				new Date(value)
			);
		} catch {
			return value;
		}
	};
</script>

<section class="mx-auto max-w-2xl space-y-6 p-[var(--cg-panel-padding)] text-ink">
	<header class="space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight">{t('pair.title')}</h1>
		<p class="text-sm text-muted">{t('pair.intro')}</p>
	</header>

	{#if failure !== null}
		<div class="cg-panel border-danger text-sm text-danger" role="alert">
			{errorText(failure)}
		</div>
	{/if}
	{#if notice}
		<div class="cg-panel border-success text-sm text-success">
			{t(notice)}
		</div>
	{/if}

	{#if activeDataSpace.syncEnabled}
		<section class="cg-panel space-y-4">
			<div class="space-y-1">
				<h2 class="text-lg font-semibold">{t('pair.thisDevice')}</h2>
				<p class="break-all text-xs text-muted">
					{t('pair.deviceId', { id: deviceId || t('pair.detecting') })}
				</p>
				{#if !editable || auth}
					<p class="break-all text-xs text-muted">
						{t('pair.server', { url: bootServerUrl ?? t('pair.serverUnset') })}
					</p>
				{/if}
			</div>

			{#if auth}
				<div class="space-y-3 text-sm">
					<p><span class="font-medium">{t('pair.status')}</span> {t('pair.connected')}</p>
					<p>
						<span class="font-medium">{t('pair.validUntil')}</span>
						{formatExpiry(auth.expiresAt)}
					</p>
					<Button type="button" onclick={() => void handleUnpair()}>{t('pair.unpair')}</Button>
				</div>
			{:else}
				<form class="space-y-4" onsubmit={handlePair}>
					{#if editable}
						<div>
							<label class="mb-1 block text-sm font-medium" for="server-url"
								>{t('pair.serverAddress')}</label
							>
							<input
								id="server-url"
								class="cg-control cg-field w-full text-sm"
								type="url"
								placeholder={t('pair.serverPlaceholder')}
								bind:value={serverUrl}
								autocomplete="url"
								spellcheck="false"
								required
							/>
							<p class="mt-1 text-xs text-muted">{t('pair.serverHint')}</p>
						</div>
					{/if}
					<div>
						<label class="mb-1 block text-sm font-medium" for="pairing-code">{t('pair.code')}</label
						>
						<input
							id="pairing-code"
							class="cg-control cg-field w-full text-sm"
							placeholder={t('pair.codePlaceholder')}
							bind:value={code}
							autocomplete="one-time-code"
							required
						/>
					</div>
					<div>
						<label class="mb-1 block text-sm font-medium" for="device-label"
							>{t('pair.deviceName')}</label
						>
						<input
							id="device-label"
							class="cg-control cg-field w-full text-sm"
							bind:value={deviceLabel}
							placeholder={t('pair.devicePlaceholder')}
							maxlength="128"
						/>
					</div>
					<Button type="submit" disabled={!canPair} variant="primary">
						{pairing ? t('pair.pairing') : t('pair.pair')}
					</Button>
				</form>
			{/if}
		</section>

		<section class="cg-panel border-dashed text-sm text-muted">
			<p class="font-medium text-ink">{t('pair.howTitle')}</p>
			<p class="mt-2">{t('pair.how')}</p>
		</section>
	{:else}
		<section class="cg-panel border-warning text-sm text-ink">
			<h2 class="text-lg font-semibold">{t('pair.scenarioTitle')}</h2>
			<p class="mt-2">
				{t('pair.scenario', {
					label: dataSpaceLabel(activeDataSpace, t),
					mine: t('dataSpace.mine')
				})}
			</p>
		</section>
	{/if}
</section>
