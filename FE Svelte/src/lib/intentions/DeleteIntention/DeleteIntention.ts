import { normalizeIntersection } from '$lib/state/triplit/Intersections/read';
import { newOperation } from '$lib/state/triplit/Repository/transaction';
import type {
	RepositoryClient,
	TraceRepository,
	Transaction
} from '$lib/state/triplit/Repository/types';
import { setTraceDeletedInTransaction } from '$lib/state/triplit/Traces/edit';
import { normalizeTrace } from '$lib/state/triplit/Traces/read';
import { TRACE_REVISION_FIELDS, traceRevisions } from '$lib/state/triplit/Traces/revisions';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import { traceLifecycleDependencies } from '$lib/state/triplit/Undo/lifecycle-guard';
import { planDeleteIntention } from './plan';
import type { DeleteMode, DeleteOptions, DeleteResult } from './types';

const deleteInTransaction = async (
	transaction: Transaction,
	intentionId: string,
	mode: DeleteMode,
	options?: DeleteOptions
): Promise<DeleteResult> => {
	const [rows, links, assessments] = await Promise.all([
		transaction.fetch('traces'),
		transaction.fetch('intersections'),
		transaction.fetch('intentionAssessments')
	]);
	const row = rows.find((item) => item.id === intentionId);
	if (!row) return { ok: false, reason: 'not_found' };
	const root = normalizeTrace(row);
	if (root.isDeleted) return { ok: false, reason: 'already_deleted' };
	if (!isIntentionRelation(root.relation)) return { ok: false, reason: 'not_intention' };
	const traces = rows.map((item) => normalizeTrace(item)).filter((trace) => !trace.isDeleted);
	const plan = planDeleteIntention(
		intentionId,
		mode,
		traces.map((trace) => ({ id: trace.id, isIntention: isIntentionRelation(trace.relation) })),
		links.map(normalizeIntersection).filter((link) => !link.isDeleted && link.kind === 'part_of')
	);
	if (
		options?.expectedDeleteIds &&
		(options.expectedDeleteIds.length !== plan.deleteIds.length ||
			new Set(options.expectedDeleteIds).size !== plan.deleteIds.length ||
			plan.deleteIds.some((id) => !options.expectedDeleteIds!.includes(id)))
	)
		return { ok: false, reason: 'plan_changed' };
	const operation = newOperation();
	const deleted = new Set(plan.deleteIds);
	// Guards are logged as each trace is deleted, but must describe the whole operation.
	// Lifecycle writes only change isDeleted among fields used by dependency fingerprints.
	const finalRows = rows.map((item) =>
		deleted.has(item.id) ? { ...item, isDeleted: true } : item
	);
	for (const id of plan.deleteIds) {
		const current = rows.find((item) => item.id === id)!;
		const revisions = traceRevisions(current);
		await setTraceDeletedInTransaction(transaction, id, true, 'user', operation, {
			revisions: Object.fromEntries(
				TRACE_REVISION_FIELDS.map((field) => [
					field,
					field === 'isDeleted' ? operation.id : (revisions[field] ?? null)
				])
			),
			dependencies: traceLifecycleDependencies(id, finalRows, links, assessments)
		});
	}
	return { ok: true, operationId: operation.id, deletedIds: plan.deleteIds };
};

export const createDeleteIntentionRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'deleteIntention'> => ({
	deleteIntention: async (intentionId, mode, options) => {
		await client.ready?.();
		return client.transact((transaction) =>
			deleteInTransaction(transaction, intentionId, mode, options)
		);
	}
});
export { planDeleteIntention } from './plan';
export type {
	DeleteMode,
	DeleteOptions,
	DeleteResult,
	DeletePlan,
	PlanEdge,
	PlanIntention
} from './types';
