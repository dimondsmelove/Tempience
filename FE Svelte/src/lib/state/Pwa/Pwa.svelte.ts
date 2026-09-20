import type { MessageKey } from '$lib/state/Locale/types';
import { CLIENT_VERSION, PERSISTENCE_REQUEST_KEY, WORKER_VERSION } from './constants';
import type { StorageStatus } from './types';

export class PwaState {
	available = $state(false);
	checking = $state(false);
	error = $state<MessageKey | null>(null);
	notice = $state<MessageKey | null>(null);
	storage = $state.raw<StorageStatus>({ usage: null, persistent: null });
	registration: ServiceWorkerRegistration | null = null;
	private reload: () => void = () => location.reload();

	/**
	 * The page tells the controlling worker its build and the worker answers with its own.
	 * A reload is offered only when the two differ and the worker's build is the current one,
	 * so pressing «Обновить» always changes what the tab runs.
	 */
	connect(
		registration: ServiceWorkerRegistration,
		container: ServiceWorkerContainer,
		version: string,
		reload: () => void = () => location.reload()
	): () => void {
		this.registration = registration;
		this.reload = reload;
		const reportVersion = () =>
			container.controller?.postMessage({ type: CLIENT_VERSION, version });
		const answered = (event: MessageEvent) => {
			if (event.data?.type !== WORKER_VERSION || typeof event.data.version !== 'string') return;
			if (event.data.version === version) this.available = false;
			else void this.confirm(registration, container);
		};
		container.addEventListener('message', answered);
		container.addEventListener('controllerchange', reportVersion);
		document.addEventListener('visibilitychange', reportVersion);
		reportVersion();
		return () => {
			container.removeEventListener('message', answered);
			container.removeEventListener('controllerchange', reportVersion);
			document.removeEventListener('visibilitychange', reportVersion);
			this.registration = null;
		};
	}

	/**
	 * The controlling worker is another build than this page. The server settles which of the
	 * two is stale: a newer worker starts installing, takes over and is asked again on
	 * controllerchange; nothing newer means this page is the old one. Offline, nothing changes.
	 */
	private async confirm(
		registration: ServiceWorkerRegistration,
		container: ServiceWorkerContainer
	): Promise<void> {
		const controller = container.controller;
		try {
			await registration.update();
		} catch {
			return;
		}
		if (container.controller !== controller || registration.installing || registration.waiting)
			return;
		this.available = true;
		this.notice = null;
	}

	async check(): Promise<void> {
		if (!this.registration) {
			this.notice = 'pwa.installedOnly';
			return;
		}
		this.checking = true;
		this.error = null;
		this.notice = null;
		try {
			await this.registration.update();
			this.notice = this.available ? null : 'pwa.checked';
		} catch {
			this.error = 'pwa.checkFailed';
		} finally {
			this.checking = false;
		}
	}

	apply(): void {
		if (this.available) this.reload();
	}

	async refreshStorage(manager: StorageManager | undefined = navigator.storage): Promise<void> {
		if (!manager) return;
		const [estimate, persistent] = await Promise.all([
			manager.estimate?.().catch(() => undefined),
			manager.persisted?.().catch(() => undefined)
		]);
		this.storage = { usage: estimate?.usage ?? null, persistent: persistent ?? null };
	}

	async requestPersistence(
		manager: StorageManager | undefined = navigator.storage,
		markers?: Pick<Storage, 'getItem' | 'setItem'>
	): Promise<void> {
		if (!manager?.persist) return;
		try {
			const target = markers ?? localStorage;
			if (!target.getItem(PERSISTENCE_REQUEST_KEY)) {
				await manager.persist();
				target.setItem(PERSISTENCE_REQUEST_KEY, '1');
			}
		} catch {
			// Storage permissions may be unavailable; local editing still works without persistence.
		}
		await this.refreshStorage(manager);
	}
}

export const pwa = new PwaState();
