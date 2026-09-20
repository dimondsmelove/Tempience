/// <reference lib="webworker" />
import { base, build, files, version } from '$service-worker';
import {
	ACTIVATE_UPDATE,
	CACHE_PREFIX,
	CLIENT_VERSION,
	NAVIGATION_TIMEOUT_MS,
	WORKER_VERSION
} from './lib/state/Pwa/constants';

const worker = self as unknown as ServiceWorkerGlobalScope;
const cacheName = `${CACHE_PREFIX}${version}`;
const precache = [...build, ...files].filter(
	(path) => !path.endsWith('.woff') && !path.startsWith(`${base}/packs/`)
);
const clientVersions = new Map<string, string>();

const cachedResponse = async (request: Request | string): Promise<Response | undefined> => {
	const current = await caches.open(cacheName);
	const cached = await current.match(request);
	if (cached) return cached;
	for (const name of await caches.keys()) {
		if (name.startsWith(CACHE_PREFIX) && name !== cacheName) {
			const previous = await (await caches.open(name)).match(request);
			if (previous) return previous;
		}
	}
};

const cacheResponse = async (request: Request, response: Response): Promise<Response> => {
	if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
		await (await caches.open(cacheName)).put(request, response.clone());
	}
	return response;
};

const networkFirst = async (request: Request): Promise<Response> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
	try {
		const response = await fetch(request, { signal: controller.signal });
		if (response.status >= 500) throw new Error('App server unavailable');
		return await cacheResponse(request, response);
	} catch {
		return (
			(await cachedResponse(request)) ??
			(await cachedResponse(`${base}/`)) ??
			(await cachedResponse(`${base}/index.html`)) ??
			new Response('Tempience is offline', { status: 503 })
		);
	} finally {
		clearTimeout(timeout);
	}
};

const cacheFirst = async (request: Request): Promise<Response> =>
	(await cachedResponse(request)) ?? cacheResponse(request, await fetch(request));

worker.addEventListener('install', (event: ExtendableEvent): void => {
	// Navigations are network-first, so a reloaded tab already runs this build before this
	// worker is in charge; the worker takes over as soon as its cache is complete. Tabs still
	// on older chunks are served from the previous caches until every tab reports this build.
	event.waitUntil(
		caches
			.open(cacheName)
			.then((cache) => cache.addAll([...precache, `${base}/`]))
			.then(() => worker.skipWaiting())
	);
});

worker.addEventListener('activate', (event: ExtendableEvent): void => {
	// Existing tabs can still request old lazy chunks. They report their build after reloading.
	event.waitUntil(worker.clients.claim());
});

worker.addEventListener('message', (event: ExtendableMessageEvent): void => {
	if (event.data?.type === ACTIVATE_UPDATE) {
		// Pages of older builds still ask for it; the worker has activated itself already.
		event.waitUntil(worker.skipWaiting());
	} else if (
		event.data?.type === CLIENT_VERSION &&
		typeof event.data.version === 'string' &&
		event.source &&
		'id' in event.source
	) {
		// The page compares this build with its own to know whether a reload changes anything.
		event.source.postMessage({ type: WORKER_VERSION, version });
		clientVersions.set(event.source.id, event.data.version);
		event.waitUntil(
			(async () => {
				const clients = await worker.clients.matchAll({
					type: 'window',
					includeUncontrolled: true
				});
				if (!clients.length || clients.some((client) => clientVersions.get(client.id) !== version))
					return;
				const keys = await caches.keys();
				await Promise.all(
					keys
						.filter((key) => key.startsWith(CACHE_PREFIX) && key !== cacheName)
						.map((key) => caches.delete(key))
				);
			})()
		);
	}
});

worker.addEventListener('fetch', (event: FetchEvent): void => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== worker.location.origin) return;
	if (url.pathname.startsWith(`${base}/api/`) || url.pathname.startsWith(`${base}/packs/`)) return;
	event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request));
});
