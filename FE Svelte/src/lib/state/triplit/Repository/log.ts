import { createId, getDeviceId } from '../ids';
import type { EntityType, Log, LogAction, LogActor, LogCause } from '../types';
import { now } from './transaction';
import type { RepositoryClient, TraceRepository, Transaction } from './types';

export const normalizeLog = (value: Record<string, unknown>): Log => ({
	id: String(value.id),
	operationId: String(value.operationId),
	entityType: value.entityType as EntityType,
	entityId: String(value.entityId),
	action: value.action as LogAction,
	patch: JSON.parse(String(value.patchJson)) as Log['patch'],
	occurredAt: String(value.occurredAt),
	deviceId: String(value.deviceId),
	actor: value.actor as LogActor,
	cause: value.cause as LogCause
});

export const insertLog = async (
	transaction: Transaction,
	input: {
		operationId: string;
		entityType: EntityType;
		entityId: string;
		action: LogAction;
		patch: Record<string, unknown>;
		actor: LogActor;
		cause?: LogCause;
		occurredAt?: string;
	}
): Promise<void> => {
	await transaction.insert('logs', {
		id: createId(),
		operationId: input.operationId,
		entityType: input.entityType,
		entityId: input.entityId,
		action: input.action,
		patchJson: JSON.stringify(input.patch),
		occurredAt: input.occurredAt ?? now(),
		deviceId: getDeviceId(),
		actor: input.actor,
		cause: input.cause ?? 'normal'
	});
};

/** Newest first, as every reader of the journal shows it. */
export const byNewest = (left: Log, right: Log): number =>
	right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id);

export const createLogRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'listLogs' | 'listLogsFor'> => ({
	listLogs: async (entityId) => {
		const values = await client.fetch('logs');
		return values
			.map(normalizeLog)
			.filter((log) => entityId === undefined || log.entityId === entityId)
			.toSorted(byNewest);
	},
	listLogsFor: async (entityIds) => {
		if (entityIds.length === 0) return [];
		const wanted = new Set(entityIds);
		// The generic client reads the collection; the Triplit repository narrows the query
		// itself, so this path stays correct for both and never claims to be the bounded one.
		const values = await client.fetch('logs');
		return values
			.map(normalizeLog)
			.filter((log) => wanted.has(log.entityId))
			.toSorted(byNewest);
	}
});
