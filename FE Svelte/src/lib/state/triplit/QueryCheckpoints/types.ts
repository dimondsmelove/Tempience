/** Triplit's hybrid logical clock value: wall-clock milliseconds, a counter, the writer. */
export type Timestamp = readonly [number, number, string];

/** What the client sends when it connects a query: a checkpoint and the rows it holds for the query. */
export type QueryState = Readonly<{
	timestamp: Timestamp;
	entityIds: Readonly<Record<string, readonly string[]>>;
}>;

export type SyncMessage = Readonly<{ type: string; payload?: unknown }>;

export type ConnectQueryMessage = Readonly<{
	type: 'CONNECT_QUERY';
	payload: Readonly<{ id: string; params: unknown; state?: QueryState }>;
}>;

export type EntityDataMessage = Readonly<{
	type: 'ENTITY_DATA';
	payload: Readonly<{ timestamp: Timestamp; forQueries: readonly string[]; changes: unknown }>;
}>;

/** The two seams of the sync engine the checkpoints sit on: what it sends, what it receives. */
export type CheckpointEngine = {
	sendMessage(message: SyncMessage): boolean;
	onSyncMessageReceived(callback: (message: SyncMessage) => void): () => void;
};

/** The metadata of the client's store: Triplit keeps its shared checkpoint there, this module its own. */
export type CheckpointStore = {
	getMetadata(key: string[]): Promise<unknown>;
	setMetadata(key: string[], value: unknown): Promise<void>;
};

export type CheckpointClient = Readonly<{
	ready: Promise<unknown>;
	/** There from the start. */
	syncEngine: CheckpointEngine;
	/** There once the client is ready, and replaced when the token changes: read anew each time. */
	db: CheckpointStore;
}>;

export type QueryCheckpoints = Readonly<{
	/** The stored checkpoints are read; until then every query connects as never answered. */
	ready: Promise<void>;
	/** The checkpoint of a query on this device: the server's last answer to it, if any. */
	of(queryId: string): Timestamp | undefined;
	/** Puts the engine back as it was and stops following answers (tests). */
	close(): void;
}>;
