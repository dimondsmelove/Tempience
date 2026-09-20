import type { Timestamp } from './types';

/** The metadata key under which this device keeps the checkpoint of each query it has connected. */
export const QUERY_CHECKPOINTS_KEY = 'tempience-query-checkpoints';

/** Triplit's own key: its one shared checkpoint, written once an answer of the server is applied. */
export const SHARED_CHECKPOINT_KEY = 'latest_server_timestamp';

/**
 * Where a query the server has not answered on this device connects from: nothing is older, so the
 * server sends the query's whole result and reconciles the rows the client lists (`HybridLogicalClock.MIN`).
 */
export const CHECKPOINT_START: Timestamp = [0, 0, ''];

/**
 * How many queries keep a checkpoint; past it the oldest go. Point queries (a record by id) would
 * otherwise grow the record without bound; a query that lost its checkpoint connects from the start.
 */
export const QUERY_CHECKPOINTS_LIMIT = 2000;

/** How often the shared checkpoint is read while an answer is being applied, and for how long at most. */
export const APPLY_POLL_MS = 20;
export const APPLY_POLL_ATTEMPTS = 500;
