<script lang="ts">
	import { resolve } from '$app/paths';
	import { ThemeProvider } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import type { AppShellProps } from './types';
	import './AppShell.css';
	import { appearance } from '$lib/theme/appearance.svelte';
	import ThemeEditor from '$lib/theme/ThemeEditor/ThemeEditor.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { pwa } from '$lib/state/Pwa/Pwa.svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import DiscardDialog from '$lib/ui/DiscardDialog/DiscardDialog.svelte';
	import { LOCALES } from '$lib/state/Locale/constants';
	import '$lib/theme/appearance.css';
	import { shellTheme } from './constants';

	let { children, variant = 'default' }: AppShellProps = $props();

	let appearanceOpen = $state(false);
	onMount(() => appearance.init());
</script>

<ThemeProvider theme={shellTheme}>
	<div
		class="appearance-shell flex h-dvh flex-col overflow-hidden bg-canvas text-ink antialiased"
		style={appearance.style}
	>
		{#if pwa.available}
			<aside
				class="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-outline bg-surface px-3 py-2 text-sm text-ink"
				aria-label={t('shell.updateTitle')}
			>
				<span>{t('shell.updateAvailable')}</span>
				<!-- Applying an update reloads the app, so what only this session holds is asked
				     about too; the full old-app/new-app acceptance is its own step. -->
				<Button size="sm" onclick={() => draftGuard.exitReloading(() => pwa.apply())}
					>{t('shell.update')}</Button
				>
			</aside>
		{/if}
		<header
			class="time-identity flex shrink-0 flex-wrap items-center border-b border-outline bg-surface"
			data-testid="identity-bar"
		>
			<a href={resolve('/')} class="shrink-0 font-semibold text-ink">Tempience</a>
			{#await import('$lib/ui/DataSpaceControls.svelte') then controls}
				<controls.default identity />
			{/await}
			<select
				class="cg-control cg-control-sm locale-picker shrink-0 border border-outline bg-surface text-ink"
				aria-label={t('locale.language')}
				data-testid="locale-picker"
				value={locale.current}
				onchange={(event) => locale.set(event.currentTarget.value)}
			>
				{#each LOCALES as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
			<Button size="sm" data-testid="appearance-open" onclick={() => (appearanceOpen = true)}
				>{t('shell.appearance')}</Button
			>
		</header>
		<main class={['relative min-h-0 flex-1', variant === 'default' && 'overflow-auto']}>
			{@render children()}
		</main>
		{#if appearanceOpen}<ThemeEditor onclose={() => (appearanceOpen = false)} />{/if}
		<DiscardDialog />
	</div>
</ThemeProvider>
