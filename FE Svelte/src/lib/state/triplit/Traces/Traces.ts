import type { RepositoryClient, TraceRepository } from '../Repository/types';
import { createTraceInTransaction } from './create';
import { editTraceInTransaction, setTraceDeletedInTransaction } from './edit';
import { byNewestCaptured, normalizeTrace } from './read';
import { assertSupplementIntegrity } from './supplement';

export const createTraceCommands = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	| 'createTrace'
	| 'createTraceWithScopes'
	| 'createTraceWithScope'
	| 'editTrace'
	| 'setTraceDeleted'
	| 'listTraces'
> => ({
	// A standalone create never carries a revisits link, so a supplement marker would be an orphan.
	createTrace: async (draft, actor = 'user') =>
		client.transact(async (transaction) => {
			const trace = await createTraceInTransaction(transaction, draft, null, actor);
			await assertSupplementIntegrity(transaction, trace.id);
			return trace;
		}),
	// Direct Kind memberships replaced the capture-settings suggestions: any existing Scope set,
	// including none, is valid for a typed record. Legacy settings stay readable, never merged.
	createTraceWithScopes: async (draft, scopeIds, actor = 'user') =>
		client.transact(async (transaction) => {
			const trace = await createTraceInTransaction(transaction, draft, scopeIds, actor);
			await assertSupplementIntegrity(transaction, trace.id);
			return trace;
		}),
	createTraceWithScope: async (draft, scopeId, actor = 'user') =>
		client.transact(async (transaction) => {
			const trace = await createTraceInTransaction(transaction, draft, scopeId, actor);
			await assertSupplementIntegrity(transaction, trace.id);
			return trace;
		}),
	editTrace: async (id, patch, actor = 'user') => {
		// A rewritten JSON field is stored in its atomic shape, which needs the current schema.
		await client.ready?.();
		return client.transact(async (transaction) => {
			const trace = await editTraceInTransaction(transaction, id, patch, actor);
			await assertSupplementIntegrity(transaction, id);
			return trace;
		});
	},
	// The command answers with the operation it committed, and with none when it wrote nothing.
	setTraceDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact((transaction) =>
			setTraceDeletedInTransaction(transaction, id, isDeleted, actor)
		),
	listTraces: async (includeDeleted = false) => {
		const values = await client.fetch('traces');
		return values
			.map((row) => normalizeTrace(row))
			.filter((trace) => includeDeleted || !trace.isDeleted)
			.toSorted(byNewestCaptured);
	}
});
