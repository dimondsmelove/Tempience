import { normalizeIntersection } from '../Intersections/read';
import { linkSourceId, resolveLinkSource } from '../IntentionAssessments/binding';
import {
	normalizeIntentionAssessment,
	overrideStatement,
	parseStoredAssessment
} from '../IntentionAssessments/read';
import { RepositoryError } from '../Repository/errors';
import type { Entity, Transaction } from '../Repository/types';
import { normalizeTrace } from '../Traces/read';
import { traceRevisions } from '../Traces/revisions';
import type { InversePlan, InverseStep } from './plan';

/** Values compare by content: replicas store merged JSON maps in their own key order. */
export const canonical = (value: unknown): string =>
	JSON.stringify(value ?? null, (_key, entry: unknown) =>
		entry !== null && typeof entry === 'object' && !Array.isArray(entry)
			? Object.fromEntries(
					Object.entries(entry as Record<string, unknown>).toSorted(([a], [b]) => (a < b ? -1 : 1))
				)
			: entry
	);

const stale = (step: InverseStep, reason: string, details: Record<string, unknown> = {}): never => {
	throw new RepositoryError(
		'undo_stale',
		'Отмена невозможна: запись изменилась после этого действия.',
		{ step: step.kind, reason, ...details }
	);
};

const fetchRow = async (
	transaction: Transaction,
	collection: 'traces' | 'intersections' | 'intentionAssessments' | 'scopes',
	id: string,
	step: InverseStep
): Promise<Entity> => {
	const row = await transaction.fetchById(collection, id);
	if (!row) {
		throw new RepositoryError('undo_unavailable', 'Запись отменяемого действия недоступна.', {
			step: step.kind,
			collection,
			id
		});
	}
	return row;
};

export type GuardContext = { transaction: Transaction; plan: InversePlan };

/** Whether the plan itself compensates this source, so withdrawing its link is not hiding it. */
const ownsSource = (plan: InversePlan, assessmentId: string): boolean =>
	plan.steps.some((step) => 'assessmentId' in step && step.assessmentId === assessmentId);

/**
 * A field belongs to the offered action while its stored revision still names that action
 * and its value is the action's own after value: a later write of the same field, on any
 * replica and in any clock order, moved the revision on (also for A→B→A), while other
 * fields keep their own stamps. Rows of older writers carry no stamp and refuse.
 */
const guardTraceFields = async (
	{ transaction, plan }: GuardContext,
	step: InverseStep & { kind: 'trace.fields' }
): Promise<void> => {
	const row = await fetchRow(transaction, 'traces', step.traceId, step);
	const trace = normalizeTrace(row);
	// A record deleted since is compensated through its own deletion, not edited in the dark.
	if (trace.isDeleted) stale(step, 'lifecycle');
	const revisions = traceRevisions(row);
	for (const [field, { after }] of Object.entries(step.fields)) {
		const revision = revisions[field as keyof typeof revisions] ?? null;
		if (revision !== plan.operationId) stale(step, 'revision', { field, revision });
		if (canonical(trace[field as keyof typeof trace]) !== canonical(after)) {
			stale(step, 'value', { field });
		}
	}
};

const guardTraceLifecycle = async (
	{ transaction, plan }: GuardContext,
	step: InverseStep & { kind: 'trace.lifecycle' }
): Promise<void> => {
	const row = await fetchRow(transaction, 'traces', step.traceId, step);
	if (Boolean(row.isDeleted) !== step.deleted) stale(step, 'lifecycle');
	const revision = traceRevisions(row).isDeleted ?? null;
	if (revision !== plan.operationId) stale(step, 'revision', { field: 'isDeleted', revision });
};

const guardLink = async (
	{ transaction, plan }: GuardContext,
	step: InverseStep & { kind: 'link.created' | 'link.lifecycle' }
): Promise<void> => {
	const link = normalizeIntersection(
		await fetchRow(transaction, 'intersections', step.linkId, step)
	);
	if (link.lifecycleId !== plan.operationId) {
		stale(step, 'lifecycle', { lifecycleId: link.lifecycleId });
	}
	const deleted = step.kind === 'link.created' ? false : step.deleted;
	if (link.isDeleted !== deleted) stale(step, 'lifecycle');
	if (step.kind === 'link.created' && link.activationId !== step.activationId) {
		stale(step, 'activation', { activationId: link.activationId });
	}
	// The plan withdraws an evidence link only to return a transferred source from it; the
	// source currently at the link must be that one, not one that claimed the placement since.
	if (!deleted && link.kind === 'evidence_for') {
		const source = resolveLinkSource(
			link,
			await transaction.fetchById('intentionAssessments', linkSourceId(link))
		);
		if (source.status === 'current' && !ownsSource(plan, source.assessment.id)) {
			stale(step, 'source', { assessmentId: source.assessment.id });
		}
	}
};

/**
 * The action's own first creation is taken back as a candidate: any other first creation,
 * known here or still on its way from another replica, keeps the source alive. The source's
 * own lifecycle and corrections must not have moved on since the creation.
 */
const guardAssessmentCreated = async (
	{ transaction, plan }: GuardContext,
	step: InverseStep & { kind: 'assessment.created' }
): Promise<void> => {
	const stored = parseStoredAssessment(
		await fetchRow(transaction, 'intentionAssessments', step.assessmentId, step)
	);
	const candidate = stored.initial[plan.operationId];
	if (!candidate) stale(step, 'candidate', { operationIds: Object.keys(stored.initial) });
	if (candidate.withdrawn !== undefined) {
		stale(step, 'candidate', { withdrawn: candidate.withdrawn });
	}
	if (
		stored.isDeleted === true ||
		(stored.lifecycleId != null && stored.lifecycleId !== plan.operationId)
	) {
		stale(step, 'lifecycle', { lifecycleId: stored.lifecycleId ?? null });
	}
	// A known standing correction of another operation is reported rather than left to stand
	// alone; an inert slot of an earlier inverse does not count.
	for (const [feature, override] of Object.entries(stored.values ?? {})) {
		const owner = override ? overrideStatement(override) : null;
		if (owner !== null && owner !== plan.operationId) {
			stale(step, 'newer_change', { field: feature, operationId: owner });
		}
	}
};

const guardAssessmentLifecycle = async (
	{ transaction, plan }: GuardContext,
	step: InverseStep & { kind: 'assessment.lifecycle' }
): Promise<void> => {
	const stored = parseStoredAssessment(
		await fetchRow(transaction, 'intentionAssessments', step.assessmentId, step)
	);
	if (stored.lifecycleId !== plan.operationId) {
		stale(step, 'lifecycle', { lifecycleId: stored.lifecycleId ?? null });
	}
	if ((stored.isDeleted === true) !== step.deleted) stale(step, 'lifecycle');
};

const guardAssessmentValues = async (
	{ transaction, plan }: GuardContext,
	step: InverseStep & { kind: 'assessment.values' }
): Promise<void> => {
	const row = await fetchRow(transaction, 'intentionAssessments', step.assessmentId, step);
	const stored = parseStoredAssessment(row);
	const current = normalizeIntentionAssessment(row);
	if (current.isDeleted) stale(step, 'lifecycle');
	const features = [
		...(Object.keys(step.features) as ('outcome' | 'open')[]),
		...step.restated.map((entry) => entry.feature)
	];
	for (const feature of features) {
		const override = stored.values?.[feature];
		if (!override || override.operationId !== plan.operationId) {
			stale(step, 'newer_change', { field: feature, operationId: override?.operationId ?? null });
		}
		const change = step.features[feature];
		if (change && canonical(current[feature]) !== canonical(change.after)) {
			stale(step, 'value', { field: feature });
		}
	}
};

const guardAssessmentPlacement = async (
	{ transaction, plan }: GuardContext,
	step: InverseStep & { kind: 'assessment.placement' }
): Promise<void> => {
	const row = await fetchRow(transaction, 'intentionAssessments', step.assessmentId, step);
	const stored = parseStoredAssessment(row);
	const current = normalizeIntentionAssessment(row);
	if (stored.isDeleted === true || stored.lifecycleId !== plan.operationId) {
		stale(step, 'lifecycle', { lifecycleId: stored.lifecycleId ?? null });
	}
	if (current.placementRevision !== plan.operationId) {
		stale(step, 'placement', { placementRevision: current.placementRevision });
	}
	for (const field of ['intentionId', 'evidenceId', 'activationId'] as const) {
		if (current[field] !== step.after[field]) stale(step, 'placement', { field });
	}
	const moved = normalizeIntersection(
		await fetchRow(transaction, 'intersections', step.after.evidenceId, step)
	);
	if (
		moved.isDeleted ||
		moved.lifecycleId !== plan.operationId ||
		moved.activationId !== step.after.activationId ||
		moved.assessmentId !== step.assessmentId
	) {
		stale(step, 'binding', { linkId: moved.id });
	}
	const original = normalizeIntersection(
		await fetchRow(transaction, 'intersections', step.before.evidenceId, step)
	);
	if (!original.isDeleted || original.lifecycleId !== plan.operationId) {
		// The original pair was relinked or restored on its own: P2 collision, not a return.
		stale(step, 'original', { linkId: original.id, lifecycleId: original.lifecycleId });
	}
	if (original.activationId !== step.before.activationId) {
		stale(step, 'activation', { linkId: original.id });
	}
};

const guardScope = async (
	{ transaction, plan }: GuardContext,
	step: InverseStep & { kind: 'scope.lifecycle' }
): Promise<void> => {
	const row = await fetchRow(transaction, 'scopes', step.scopeId, step);
	if (row.isDeleted !== true || row.deletionOperationId !== plan.operationId) {
		stale(step, 'lifecycle', { deletionOperationId: row.deletionOperationId ?? null });
	}
};

/** Every step is checked against the current rows before the first compensating write. */
export const assertInvertible = async (context: GuardContext): Promise<void> => {
	for (const step of context.plan.steps) {
		switch (step.kind) {
			case 'trace.fields':
				await guardTraceFields(context, step);
				break;
			case 'trace.lifecycle':
				await guardTraceLifecycle(context, step);
				break;
			case 'link.created':
			case 'link.lifecycle':
				await guardLink(context, step);
				break;
			case 'assessment.created':
				await guardAssessmentCreated(context, step);
				break;
			case 'assessment.lifecycle':
				await guardAssessmentLifecycle(context, step);
				break;
			case 'assessment.values':
				await guardAssessmentValues(context, step);
				break;
			case 'assessment.placement':
				await guardAssessmentPlacement(context, step);
				break;
			case 'scope.lifecycle':
				await guardScope(context, step);
				break;
		}
	}
};
