<script lang="ts">
	import '../app.css';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser, dev, version } from '$app/environment';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { pwa } from '$lib/state/Pwa/Pwa.svelte';
	import { locale } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { themeState } from '$lib/theme/theme.svelte';

	let { children } = $props();
	// The saved interface language is read here, before any child is constructed, so the
	// first render already speaks it; onMount would run after that render. The guard keeps
	// build-time and other non-browser evaluation away from local storage.
	if (browser) locale.init();

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

{@render children()}
