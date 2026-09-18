import { readable, type Readable } from 'svelte/store';
import { clearStoredAuth, getStoredToken, getTriplitServerUrl } from './auth';
import type { TempienceTriplitClient } from './client';
import {
	combineCollectionCounts,
	getCollectionCounts,
	getServerCollectionCounts,
	unavailableServerCounts,
	type SyncCollectionDiagnostics,
	type SyncCollectionName
} from './sync-status-counts';

export type { SyncCollectionDiagnostics, SyncCollectionName } from './sync-status-counts';

export type SyncConnectionStatus =
	'local-only' | 'unpaired' | 'connecting' | 'online' | 'offline' | 'error';

export type SyncDiagnosticsSnapshot = {
	collections: Record<SyncCollectionName, SyncCollectionDiagnostics>;
	pending: number;
	serverError: string | null;
	checkedAt: string;
};

export type SyncStatusSnapshot = {
	connection: SyncConnectionStatus;
	pending: number;
	lastSyncedAt: string | null;
	error: string | null;
};

export type SyncModeOptions = {
	syncEnabled?: boolean;
};

const LAST_SYNCED_AT_KEY = 'tempience.triplit.last-synced-at';

const browserOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine;

const readLastSyncedAt = (): string | null => {
	if (typeof localStorage === 'undefined') return null;
	try {
		return localStorage.getItem(LAST_SYNCED_AT_KEY);
	} catch {
		return null;
	}
};

const saveLastSyncedAt = (value: string): void => {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(LAST_SYNCED_AT_KEY, value);
	} catch {
		// Sync status remains available for the current session when storage is blocked.
	}
};

export const mapConnectionStatus = (
	status: string,
	hasToken: boolean,
	isOnline: boolean
): SyncConnectionStatus => {
	if (!hasToken) return 'unpaired';
	if (!isOnline) return 'offline';
	switch (status) {
		case 'OPEN':
			return 'online';
		case 'CLOSED':
			return 'offline';
		case 'UNINITIALIZED':
		case 'CONNECTING':
		case 'CLOSING':
		default:
			return 'connecting';
	}
};

export const getPendingChangeCount = async (client: TempienceTriplitClient): Promise<number> => {
	if (client.awaitReady) await client.awaitReady;
	const changes = await client.db.entityStore.doubleBuffer.getChanges(client.db.kv);

	// The fetch API ignores syncStatus; the double buffer is the actual Triplit outbox.
	return Object.values(changes).reduce((total, collectionChanges) => {
		const entityIds = new Set([...collectionChanges.sets.keys(), ...collectionChanges.deletes]);
		return total + entityIds.size;
	}, 0);
};

export const getSyncDiagnostics = async (
	client: TempienceTriplitClient,
	options: SyncModeOptions = {}
): Promise<SyncDiagnosticsSnapshot> => {
	const syncEnabled = options.syncEnabled ?? true;
	const [pending, local, remote] = await Promise.all([
		syncEnabled ? getPendingChangeCount(client) : Promise.resolve(0),
		getCollectionCounts(client, 'local-only'),
		syncEnabled
			? getServerCollectionCounts(client)
			: Promise.resolve({ counts: unavailableServerCounts(), error: null })
	]);
	return {
		collections: combineCollectionCounts(local, remote.counts),
		pending,
		serverError: remote.error,
		checkedAt: new Date().toISOString()
	};
};

const initialSnapshot = (syncEnabled: boolean): SyncStatusSnapshot =>
	syncEnabled
		? {
				connection: mapConnectionStatus(
					'UNINITIALIZED',
					Boolean(getStoredToken()),
					browserOnline()
				),
				pending: 0,
				lastSyncedAt: readLastSyncedAt(),
				error: null
			}
		: {
				connection: 'local-only',
				pending: 0,
				lastSyncedAt: null,
				error: null
			};

export const createSyncStatusStore = (
	client: TempienceTriplitClient,
	options: SyncModeOptions = {}
): Readable<SyncStatusSnapshot> => {
	const syncEnabled = options.syncEnabled ?? true;
	const initial = initialSnapshot(syncEnabled);
	if (!syncEnabled) return readable(initial);

	return readable<SyncStatusSnapshot>(initial, (set) => {
		if (typeof window === 'undefined') return;

		let current = initial;
		let disposed = false;
		let pendingRequest = 0;
		const publish = (patch: Partial<SyncStatusSnapshot>): void => {
			current = { ...current, ...patch };
			set(current);
		};

		const refreshPending = async (): Promise<void> => {
			const request = ++pendingRequest;
			try {
				const pending = await getPendingChangeCount(client);
				if (!disposed && request === pendingRequest) publish({ pending });
			} catch {
				// Local data may not be initialized yet; the next event or poll retries it.
			}
		};

		const refreshConnection = (status: string): void => {
			publish({
				connection: mapConnectionStatus(status, Boolean(getStoredToken()), browserOnline())
			});
		};

		const markSynced = (): void => {
			const timestamp = new Date().toISOString();
			saveLastSyncedAt(timestamp);
			publish({ lastSyncedAt: timestamp, error: null });
		};

		const unsubscribeConnection = client.onConnectionStatusChange((status): void => {
			refreshConnection(status);
			void refreshPending();
		}, true);
		const unsubscribeReceived = client.onSyncMessageReceived((message): void => {
			if (message.type === 'ENTITY_DATA' || message.type === 'CHANGES_ACK') markSynced();
			if (message.type === 'ERROR') {
				publish({
					connection: 'error',
					error: message.payload.error.message || 'sync_error'
				});
			}
			void refreshPending();
		});
		const unsubscribeSent = client.onSyncMessageSent(() => void refreshPending());
		const unsubscribeFailure = client.onFailureToSyncWrites((cause: unknown): void => {
			publish({
				connection: 'error',
				error: cause instanceof Error ? cause.message : 'sync_send_failed'
			});
			void refreshPending();
		});
		const unsubscribeSessionError = client.onSessionError((type): void => {
			if (type === 'TOKEN_EXPIRED' || type === 'UNAUTHORIZED') clearStoredAuth();
			publish({
				connection: getStoredToken() ? 'error' : 'unpaired',
				error: `session:${type}`
			});
		});

		const handleOnline = (): void => {
			refreshConnection(client.connectionStatus);
			publish({ error: null });
			if (getTriplitServerUrl() && getStoredToken()) void client.connect();
			void refreshPending();
		};
		const handleOffline = (): void => publish({ connection: 'offline' });
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		const pendingTimer = window.setInterval(() => void refreshPending(), 2000);
		void refreshPending();

		return () => {
			disposed = true;
			window.clearInterval(pendingTimer);
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
			unsubscribeConnection();
			unsubscribeReceived();
			unsubscribeSent();
			unsubscribeFailure();
			unsubscribeSessionError();
		};
	});
};
