<script lang="ts">
	import '../app.css';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser, dev, version } from '$app/environment';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import type { Attachment } from 'svelte/attachments';
	import Onboarding from '$lib/time/Onboarding/Onboarding.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { tour } from '$lib/state/Tour/Tour.svelte';
	import { openDemoAndReload } from '$lib/state/triplit/demo-actions';
	import { pwa } from '$lib/state/Pwa/Pwa.svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { themeState } from '$lib/theme/theme.svelte';

	let { children } = $props();
	// The saved interface language is read here, before any child is constructed, so the
	// first render already speaks it; onMount would run after that render. The guard keeps
	// build-time and other non-browser evaluation away from local storage.
	if (browser) locale.init(undefined, navigator.languages);

	onMount(() => {
		themeState.init();
		let disposed = false;
		let disconnect: (() => void) | undefined;
		void pwa.requestPersistence();
		if (!dev && 'serviceWorker' in navigator) {
			void navigator.serviceWorker
				.register(`${base}/service-worker.js`, { updateViaCache: 'none' })
				.then((registration) => {
					if (!disposed) disconnect = pwa.connect(registration, navigator.serviceWorker, version);
				})
				.catch(() => {
					pwa.error = 'shell.offlineFailed';
				});
		}
		return () => {
			disposed = true;
			disconnect?.();
		};
	});

	afterNavigate(() => {
		themeState.sync();
	});

	/** The demo card of the tour: the app reloads into the demo, so an open form is asked about first. */
	const openDemoFromTour = (): void => {
		draftGuard.exitReloading(() => {
			tour.hide();
			openDemoAndReload();
		});
	};
	/** Keyboard users land inside the overlay; Tab then reaches «Закрыть» first. */
	const focusOnMount: Attachment<HTMLElement> = (element) => {
		element.focus();
	};

	// A route change ends an open form like any other exit; a changed one asks first and
	// the same navigation is issued once after «Отбросить изменения». Leaving the page
	// (reload, close) cannot show the app's question: the cancelled navigation lets the
	// browser ask its own way, with its own text.
	beforeNavigate((navigation) => {
		if (!draftGuard.dirty && !draftGuard.busy) return;
		// The same URL again (the app title on the workbench) leaves the page and its form as they are.
		if (navigation.to && navigation.from?.url.href === navigation.to.url.href) return;
		navigation.cancel();
		if (navigation.type === 'leave' || !navigation.to) return;
		// SvelteKit has stepped a cancelled history move back; after the question the same
		// step is repeated with its delta, so Back keeps its Forward. A link is issued once, to
		// SvelteKit's own resolved URL of this app, base included.
		const { pathname, search, hash } = navigation.to.url;
		const target = `${pathname}${search}${hash}` as ResolvedPathname;
		const delta = navigation.type === 'popstate' ? navigation.delta : undefined;
		void draftGuard.confirm().then((proceed) => {
			if (!proceed) return;
			if (delta) history.go(delta);
			else void goto(target);
		});
	});
</script>

<!-- Escape closes the tour unless the draft guard's own question is up: that one keeps editing. -->
<svelte:window
	onkeydown={(event) => {
		if (tour.open && event.key === 'Escape' && !draftGuard.request) tour.hide();
	}}
/>

{@render children()}

<!-- The tour from the menu, over the app, in both builds. The overlay sits outside the shell,
     so it carries the shell's appearance itself: the same roles and tokens as everything under it. -->
{#if tour.open}
	<div
		class="appearance-shell fixed inset-0 z-50 bg-canvas text-ink"
		style={appearance.style}
		role="dialog"
		aria-label={t('onboarding.title')}
		tabindex="-1"
		data-testid="tour-overlay"
		{@attach focusOnMount}
	>
		<Onboarding onstart={tour.hide} ondemo={openDemoFromTour} onclose={tour.hide} />
	</div>
{/if}
