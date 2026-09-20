<script lang="ts">
	import './ThemeEditor.css';
	import type { Attachment } from 'svelte/attachments';
	import Button from '$lib/ui/Button/Button.svelte';
	import { overlayScrollbar } from '$lib/ui/Scrollbar';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { MessageKey } from '$lib/state/Locale/types';
	import { appearance } from '../appearance.svelte';
	import { baseline } from '../catalog';
	import { defaultDevice, lensBounds } from '../constants';
	import { parseTheme } from '../normalize';
	import type { ResolvedTheme } from '../resolve-theme';
	import { themeState } from '../theme.svelte';
	import type { DeviceAppearance, Theme } from '../types';
	import ThemeFields from './ThemeFields.svelte';
	import RowHeight from '../RowHeight/RowHeight.svelte';

	let { onclose }: { onclose: () => void } = $props();
	let draft = $state<Theme>(parseTheme(appearance.savedTheme)!);
	let local = $state<DeviceAppearance>({ ...appearance.savedDevice });
	let selectedId = $state(appearance.savedTheme.id);
	// The proposed name is the user's to edit from here on; it is composed once, when offered.
	let name = $state(appearance.savedTheme.name.slice(0, 70) + t('theme.mineSuffix'));
	let palette = $state<ResolvedTheme>(themeState.resolved);
	let tab = $state<'theme' | 'device'>('theme');
	let busy = $state(false);
	/** What the footer says: a notice of the interface's, or the failure of the last command. */
	let notice = $state<MessageKey | null>(null);
	let failure = $state.raw<unknown>(null);
	let valid = $state(true);
	const original = $derived(appearance.themes.find((theme) => theme.id === selectedId) ?? baseline);
	const dirty = $derived(
		JSON.stringify({ colors: draft.colors, metrics: draft.metrics, fonts: draft.fonts }) !==
			JSON.stringify({ colors: original.colors, metrics: original.metrics, fonts: original.fonts })
	);
	const sharedName = $derived(
		appearance.themes.find((theme) => theme.id === appearance.defaults.themeId)?.name
	);
	const close = () => {
		appearance.cancel();
		onclose();
	};
	const show: Attachment<HTMLDialogElement> = (element) => {
		element.showModal();
		return () => element.close();
	};
	const preview = () => {
		valid = appearance.preview(draft, local);
		notice = valid ? null : 'theme.invalidValues';
		failure = null;
	};
	const pick = (id: string) => {
		const theme = appearance.themes.find((item) => item.id === id);
		if (!theme) return;
		selectedId = id;
		draft = parseTheme(theme)!;
		name = theme.name.slice(0, 70) + t('theme.mineSuffix');
		local.themeId = id;
		preview();
	};
	const run = async (action: () => Promise<void>) => {
		busy = true;
		notice = null;
		failure = null;
		try {
			await action();
		} catch (cause) {
			failure = cause ?? new Error();
		} finally {
			busy = false;
		}
	};
	const save = () =>
		run(async () => {
			const theme = await appearance.saveCopy(draft, name, local);
			selectedId = theme.id;
			draft = parseTheme(theme)!;
			local = { ...appearance.savedDevice };
			name = theme.name;
			notice = 'theme.savedNew';
		});
	const makeDefault = () =>
		run(async () => {
			await appearance.makeDefault(selectedId, local.mode ?? appearance.defaults.mode);
			local = { ...local, themeId: null, mode: null };
			preview();
			notice = 'theme.madeShared';
		});
	const apply = () => {
		appearance.applyDevice(local);
		close();
	};
	const resetSizes = () => {
		local = { ...defaultDevice, themeId: local.themeId, mode: local.mode };
		preview();
	};
	const DEVICE_RANGES = [
		['textScale', 'theme.textScale', 0.8, 1.5, 0.05],
		['density', 'theme.density', 0.75, 1.5, 0.05],
		['railWidth', 'theme.railWidth', 120, 480, 4],
		['contextWidth', 'theme.contextWidth', 240, 600, 4],
		['lens', 'theme.lens', lensBounds.min, lensBounds.max, lensBounds.step]
	] as const;
</script>

<dialog class="theme-editor" aria-labelledby="appearance-title" onclose={close} {@attach show}>
	<header class="editor-header">
		<div>
			<h2 id="appearance-title" class="cg-heading">{t('theme.title')}</h2>
			<p class="text-xs text-muted">{t(appearance.connection)}</p>
		</div>
		<Button variant="quiet" onclick={close} aria-label={t('theme.close')}>✕</Button>
	</header>
	<!-- The body scrolls on a short screen (1280×720 already) under the shared overlay bar, not a native one (C7). -->
	<div class="editor-body" {@attach overlayScrollbar}>
		{#if appearance.error !== null}<p role="alert" class="text-xs text-[color:var(--cg-danger)]">
				{errorText(appearance.error)}
			</p>{/if}
		{#if appearance.missingTheme}<p class="text-xs text-muted">
				{t('theme.missing', { name: baseline.name })}
			</p>{/if}
		{#if appearance.needsCacheReset}
			<Button
				onclick={() => {
					appearance.resetDevice();
					local = { ...appearance.savedDevice };
					pick(appearance.savedTheme.id);
				}}>{t('theme.resetUnsupported')}</Button
			>
		{/if}
		<fieldset disabled={busy}>
			<label class="cg-label"
				>{t('theme.theme')}
				<select
					class="cg-control cg-field"
					aria-label={t('theme.theme')}
					value={selectedId}
					onchange={(e) => pick(e.currentTarget.value)}
				>
					{#each appearance.themes as theme (theme.id)}<option value={theme.id}>{theme.name}</option
						>{/each}
				</select>
			</label>
			<div class="palette-preview" aria-label={t('theme.paletteOf')}>
				{#each ['canvas', 'surface', 'raised', 'accent', 'secondary'] as key (key)}
					<span style:background={draft.colors[palette][key as keyof Theme['colors']['dark']]}
					></span>
				{/each}
			</div>
			<div class="flex flex-wrap gap-2" aria-label={t('theme.palette')}>
				{#each [['dark', 'theme.dark'], ['light', 'theme.light']] as const as [mode, label] (mode)}
					<Button
						size="sm"
						pressed={palette === mode}
						onclick={() => {
							palette = mode;
							local.mode = palette;
							preview();
						}}>{t(label)}</Button
					>
				{/each}
			</div>
			<div class="editor-tabs">
				<Button pressed={tab === 'theme'} onclick={() => (tab = 'theme')}
					>{t('theme.tabTheme')}</Button
				>
				<Button pressed={tab === 'device'} onclick={() => (tab = 'device')}
					>{t('theme.tabDevice')}</Button
				>
			</div>
			{#if tab === 'theme'}
				<p class="text-xs text-muted">{t('theme.liveHint')}</p>
				<ThemeFields bind:theme={draft} mode={palette} onchange={preview} />
				<Button
					size="sm"
					disabled={!dirty}
					onclick={() => {
						draft = parseTheme(original)!;
						preview();
					}}>{t('theme.resetChanges')}</Button
				>
				{#if selectedId.startsWith('preset:')}<p class="text-xs text-muted">
						{t('theme.presetNotice')}
					</p>{/if}
				<label class="cg-label"
					>{t('theme.newName')}<input
						class="cg-control cg-field"
						maxlength="80"
						bind:value={name}
					/></label
				>
				<Button
					disabled={!valid || !name.trim() || !appearance.ready}
					variant="primary"
					onclick={save}>{t('theme.saveNew')}</Button
				>
				<section class="shared-theme">
					<p class="text-xs text-muted">
						{t('theme.shared', { name: sharedName ?? t('theme.sharedUnavailable') })}
					</p>
					<Button size="sm" disabled={dirty || !valid || !appearance.ready} onclick={makeDefault}
						>{t('theme.makeShared')}</Button
					>
					<p class="text-xs text-muted">{t('theme.sharedHint')}</p>
				</section>
			{:else}
				<label class="cg-label"
					>{t('theme.deviceChoice')}
					<select
						class="cg-control cg-field"
						value={local.themeId === null ? 'shared' : 'local'}
						onchange={(e) => {
							if (e.currentTarget.value === 'shared') {
								const shared =
									appearance.themes.find((t) => t.id === appearance.defaults.themeId) ?? baseline;
								selectedId = shared.id;
								draft = parseTheme(shared)!;
								local.themeId = null;
							} else local.themeId = selectedId;
							preview();
						}}
					>
						<option value="shared">{t('theme.followShared')}</option><option value="local"
							>{t('theme.ownChoice')}</option
						>
					</select>
				</label>
				<label class="cg-label"
					>{t('theme.mode')}
					<select
						class="cg-control cg-field"
						value={local.mode ?? 'shared'}
						onchange={(e) => {
							local.mode =
								e.currentTarget.value === 'shared'
									? null
									: (e.currentTarget.value as DeviceAppearance['mode']);
							preview();
							palette = themeState.resolved;
						}}
					>
						<option value="shared">{t('theme.modeShared')}</option><option value="system"
							>{t('theme.modeSystem')}</option
						>
						<option value="dark">{t('theme.modeDark')}</option><option value="light"
							>{t('theme.modeLight')}</option
						>
					</select>
				</label>
				<RowHeight
					value={local.rowHeightPx}
					onchange={(value) => {
						local.rowHeightPx = value;
						preview();
					}}
				/>
				{#each DEVICE_RANGES as [key, label, min, max, step] (key)}
					<label class="cg-label"
						>{t(label)}: {local[key]}
						<input
							type="range"
							{min}
							{max}
							{step}
							value={local[key]}
							oninput={(e) => {
								local[key] = e.currentTarget.valueAsNumber;
								preview();
							}}
						/>
					</label>
				{/each}
				<label class="text-xs"
					><input
						type="checkbox"
						checked={local.railOpen}
						onchange={(e) => {
							local.railOpen = e.currentTarget.checked;
							preview();
						}}
					/>
					{t('theme.keepRail')}</label
				>
				<label class="text-xs"
					><input
						type="checkbox"
						checked={local.contextOpen}
						onchange={(e) => {
							local.contextOpen = e.currentTarget.checked;
							preview();
						}}
					/>
					{t('theme.keepContext')}</label
				>
				<Button size="sm" onclick={resetSizes}>{t('theme.resetSizes')}</Button>
				<p class="text-xs text-muted">{t('theme.deviceHint')}</p>
			{/if}
		</fieldset>
	</div>
	<footer class="editor-footer">
		{#if failure !== null}<p role="alert" class="text-xs">{errorText(failure)}</p>
		{:else if notice}<p role="status" class="text-xs">{t(notice)}</p>{/if}
		<div class="editor-actions">
			<Button onclick={close}>{t('common.cancel')}</Button>
			<Button variant="primary" disabled={dirty || !valid || busy} onclick={apply}
				>{t('theme.apply')}</Button
			>
		</div>
		{#if dirty}<p class="text-xs text-muted">{t('theme.saveAsNew')}</p>{/if}
	</footer>
</dialog>
