import { createId } from '../ids';
import type { LogCause } from '../types';
import type { Collection, Entity, Transaction } from './types';

let lastTimestamp = 0;

export const now = (): string => {
	const timestamp = Math.max(Date.now(), lastTimestamp + 1);
	lastTimestamp = timestamp;
	return new Date(timestamp).toISOString();
};

/**
 * One user operation: every row written and every Log entry of a compound command share
 * this identity and moment. It is neither an entity id nor a link activation id. A cause
 * marks every Log entry of an inverse operation; ordinary commands leave it unset.
 */
export type Operation = { id: string; timestamp: string; cause?: LogCause };

export const newOperation = (cause?: LogCause): Operation => ({
	id: createId(),
	timestamp: now(),
	...(cause ? { cause } : {})
});

export const requireEntity = async (
	transaction: Transaction,
	collection: Collection,
	id: string
): Promise<Entity> => {
	const entity = await transaction.fetchById(collection, id);
	if (!entity) throw new Error(`${collection} entity not found: ${id}`);
	return entity;
};

export const requireActiveEntity = async (
	transaction: Transaction,
	collection: Collection,
	id: string
): Promise<Entity> => {
	const entity = await requireEntity(transaction, collection, id);
	if (entity.isDeleted === true) throw new Error(`${collection} entity is deleted: ${id}`);
	return entity;
};

export const tupleId = (prefix: string, parts: Array<string | number>): string =>
	`${prefix}:${parts.map((part) => encodeURIComponent(String(part))).join(':')}`;
