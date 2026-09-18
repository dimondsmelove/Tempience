import { insertLog } from '../Repository/log';
import { now, requireEntity } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches } from '../operations';
import type { ScopeSegment } from '../types';

const scopeSegmentFields = ['scopeId', 'startAt', 'endAt', 'label', 'position'] as const;

const normalizeScopeSegment = (value: Record<string, unknown>): ScopeSegment => ({
	id: String(value.id),
	scopeId: String(value.scopeId),
	startAt: (value.startAt as string | null | undefined) ?? null,
	endAt: (value.endAt as string | null | undefined) ?? null,
	label: (value.label as string | null | undefined) ?? null,
	position: Number(value.position ?? 0),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

export const createScopeSegmentRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'createScopeSegment' | 'bumpScopeSegment' | 'listScopeSegments'> => ({
	createScopeSegment: async (scopeId, draft, actor = 'user') =>
		client.transact(async (transaction) => {
			await requireEntity(transaction, 'scopes', scopeId);
			const segments = await transaction.fetch('scopeSegments');
			const position =
				draft.position ??
				Math.max(
					-1,
					...segments
						.filter((segment) => segment.scopeId === scopeId)
						.map((segment) => Number(segment.position ?? -1))
				) + 1;
			const timestamp = now();
			const row = {
				id: createId(),
				scopeId,
				startAt: draft.startAt ?? null,
				endAt: draft.endAt ?? null,
				label: draft.label ?? null,
				position,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			await transaction.insert('scopeSegments', row);
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'scopeSegment',
				entityId: row.id,
				action: 'created',
				patch: { snapshot: row },
				actor
			});
			return normalizeScopeSegment(row);
		}),
	// Close the latest open segment and append the next segment atomically.
	bumpScopeSegment: async (scopeId, draft, actor = 'user') =>
		client.transact(async (transaction) => {
			await requireEntity(transaction, 'scopes', scopeId);
			const segments = (await transaction.fetch('scopeSegments'))
				.map(normalizeScopeSegment)
				.filter((segment) => segment.scopeId === scopeId)
				.toSorted((a, b) => a.position - b.position);
			const open = segments.filter((segment) => segment.endAt === null).at(-1);
			if (open?.startAt && draft.at <= open.startAt) {
				throw new Error('Scope segment bump must be after the open segment start');
			}
			const timestamp = now();
			const operationId = createId();
			if (open) {
				const closed = { ...open, endAt: draft.at, updatedAt: timestamp };
				await transaction.update('scopeSegments', open.id, {
					endAt: closed.endAt,
					updatedAt: closed.updatedAt
				});
				await insertLog(transaction, {
					operationId,
					entityType: 'scopeSegment',
					entityId: open.id,
					action: 'updated',
					patch: buildFieldPatches(open, closed, scopeSegmentFields),
					actor
				});
			}
			const row = {
				id: createId(),
				scopeId,
				startAt: draft.at,
				endAt: null,
				label: draft.label ?? null,
				position: (segments.at(-1)?.position ?? -1) + 1,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			await transaction.insert('scopeSegments', row);
			await insertLog(transaction, {
				operationId,
				entityType: 'scopeSegment',
				entityId: row.id,
				action: 'created',
				patch: { snapshot: row },
				actor
			});
			return normalizeScopeSegment(row);
		}),
	listScopeSegments: async (scopeId) => {
		const values = await client.fetch('scopeSegments');
		return values
			.map(normalizeScopeSegment)
			.filter((segment) => scopeId === undefined || segment.scopeId === scopeId)
			.toSorted((a, b) => a.position - b.position);
	}
});
