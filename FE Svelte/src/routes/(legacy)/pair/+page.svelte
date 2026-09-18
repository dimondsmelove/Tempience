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
		getStoredAuth,
		getTriplitServerUrl,
		pairDevice,
		type DeviceAuth
	} from '$lib/state/triplit/auth';
	import { getDeviceId } from '$lib/state/triplit/ids';
	import { activeDataSpace, triplit } from '$lib/state/triplit/client';
	import { dataSpaceLabel } from '$lib/state/triplit/data-space';

	let code = $state('');
	let deviceLabel = $state('');
	let deviceId = $state('');
	let auth = $state<DeviceAuth | null>(null);
	let pairing = $state(false);
	/** The last failure, read in the language of the moment; the notice is a key of the catalogs. */
	let failure = $state.raw<unknown>(null);
	let notice = $state<MessageKey | null>(null);

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
			const nextAuth = await pairDevice(code, deviceLabel);
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

<svelte:head>
	<title>{t('pair.title')} · Tempience</title>
</svelte:head>

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

	{#if !getTriplitServerUrl()}
		<section class="cg-panel space-y-2 text-ink">
			<h2 class="font-semibold">{t('pair.notConfigured')}</h2>
			<p>{t('pair.local')}</p>
		</section>
	{:else if activeDataSpace.syncEnabled}
		<section class="cg-panel space-y-4">
			<div class="space-y-1">
				<h2 class="text-lg font-semibold">{t('pair.thisDevice')}</h2>
				<p class="break-all text-xs text-muted">
					{t('pair.deviceId', { id: deviceId || t('pair.detecting') })}
				</p>
				<p class="break-all text-xs text-muted">
					{t('pair.server', { url: getTriplitServerUrl() ?? t('pair.serverUnset') })}
				</p>
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
					<Button
						type="submit"
						disabled={pairing || code.trim().length === 0 || !getTriplitServerUrl()}
						variant="primary"
					>
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
