import type { MessageKey } from '$lib/state/Locale/types';
import { ACTIVATE_UPDATE, CLIENT_VERSION, PERSISTENCE_REQUEST_KEY } from './constants';
import type { StorageStatus } from './types';

export class PwaState {
	available = $state(false);
	checking = $state(false);
	error = $state<MessageKey | null>(null);
	notice = $state<MessageKey | null>(null);
	storage = $state.raw<StorageStatus>({ usage: null, persistent: null });
	registration: ServiceWorkerRegistration | null = null;
	private applying = false;

	connect(
		registration: ServiceWorkerRegistration,
		container: ServiceWorkerContainer,
		version: string,
		reload: () => void = () => location.reload()
	): () => void {
		this.registration = registration;
		let hadController = Boolean(container.controller);
		const workers: ServiceWorker[] = [];
		const reportVersion = () =>
			container.controller?.postMessage({ type: CLIENT_VERSION, version });
		const installed = () => {
			if (registration.waiting && container.controller) this.available = true;
		};
		const watch = () => {
			const worker = registration.installing;
			if (worker && !workers.includes(worker)) {
				workers.push(worker);
				worker.addEventListener('statechange', installed);
			}
			installed();
		};
		const changed = () => {
			reportVersion();
			if (this.applying) reload();
			else if (hadController) this.available = true;
			hadController = true;
		};
		registration.addEventListener('updatefound', watch);
		container.addEventListener('controllerchange', changed);
		document.addEventListener('visibilitychange', reportVersion);
		watch();
		reportVersion();
		return () => {
			registration.removeEventListener('updatefound', watch);
			container.removeEventListener('controllerchange', changed);
			document.removeEventListener('visibilitychange', reportVersion);
			for (const worker of workers) worker.removeEventListener('statechange', installed);
			this.registration = null;
		};
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
		if (this.registration?.waiting) {
			this.applying = true;
			this.registration.waiting.postMessage({ type: ACTIVATE_UPDATE });
		} else if (this.available) {
			location.reload();
		}
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
