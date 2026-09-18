import { RepositoryError } from '../Repository/errors';
import type { IntersectionKind, Log } from '../types';

export type FieldChange = { before: unknown; after: unknown };

/** A feature change of a source with the operation that owned the value before, if any. */
export type FeatureChange = FieldChange & { ownerBefore: string | null };

export type AssessmentAddress = { intentionId: string; evidenceId: string; activationId: string };

/**
 * One owned consequence of the offered action, read from its own journal entries. Each step
 * names the record and the revision the action left behind, so the inverse can verify that
 * exactly this consequence is still current before compensating it.
 */
export type InverseStep =
	| { kind: 'trace.fields'; traceId: string; fields: Record<string, FieldChange> }
	| { kind: 'trace.lifecycle'; traceId: string; deleted: boolean }
	| { kind: 'link.created'; linkId: string; activationId: string; linkKind: IntersectionKind }
	| { kind: 'link.lifecycle'; linkId: string; deleted: boolean }
	| { kind: 'assessment.created'; assessmentId: string }
	| { kind: 'assessment.lifecycle'; assessmentId: string; deleted: boolean }
	| {
			kind: 'assessment.values';
			assessmentId: string;
			/** Features whose value the operation changed. */
			features: Partial<Record<'outcome' | 'open', FeatureChange>>;
			/** Features the operation restated with the same value under its own revision. */
			restated: { feature: 'outcome' | 'open'; ownerBefore: string | null }[];
	  }
	| {
			kind: 'assessment.placement';
			assessmentId: string;
			before: AssessmentAddress;
			after: AssessmentAddress;
	  }
	| { kind: 'scope.lifecycle'; scopeId: string };

export type InversePlan = { operationId: string; occurredAt: string; steps: InverseStep[] };

const TRACE_PATCH_FIELDS = new Set([
	'content',
	'description',
	'capturedAt',
	'timezone',
	'aboutKind',
	'aboutTime',
	'statedDuration',
	'aboutTraceId',
	'relation',
	'data'
]);
const DERIVED_TRACE_FIELDS = new Set(['aboutAt', 'aboutStart', 'aboutEnd']);
const ADDRESS_FIELDS = ['intentionId', 'evidenceId', 'activationId'] as const;
const ASSESSMENT_FEATURES = ['outcome', 'open'] as const;

const UNSUPPORTED =
	'Это действие не отменяется: отмена доступна для правки и удаления записи, снятия связи и оценки, переноса оценки и удаления Scope.';

const unsupported = (log: Log): never => {
	throw new RepositoryError('undo_unsupported', UNSUPPORTED, {
		operationId: log.operationId,
		entityType: log.entityType,
		entityId: log.entityId,
		action: log.action,
		cause: log.cause
	});
};

const change = (log: Log, field: string): FieldChange | undefined =>
	log.patch[field] as FieldChange | undefined;

const traceStep = (log: Log): InverseStep => {
	if (log.action === 'deleted' || log.action === 'restored') {
		return { kind: 'trace.lifecycle', traceId: log.entityId, deleted: log.action === 'deleted' };
	}
	if (log.action !== 'updated') return unsupported(log);
	const fields: Record<string, FieldChange> = {};
	for (const [field, value] of Object.entries(log.patch)) {
		if (DERIVED_TRACE_FIELDS.has(field)) continue;
		if (!TRACE_PATCH_FIELDS.has(field)) return unsupported(log);
		fields[field] = value as FieldChange;
	}
	return { kind: 'trace.fields', traceId: log.entityId, fields };
};

const linkStep = (log: Log, operationId: string): InverseStep | null => {
	if (log.action === 'linked') {
		const snapshot = log.patch.snapshot as unknown as Record<string, unknown> | undefined;
		return {
			kind: 'link.created',
			linkId: log.entityId,
			activationId: String(snapshot?.activationId ?? `${log.entityId}:${snapshot?.createdAt}`),
			linkKind: String(snapshot?.kind) as IntersectionKind
		};
	}
	// Only a withdrawal is offered back; a link restore is not withdrawn again through an inverse.
	if (log.action !== 'deleted') return unsupported(log);
	// A membership hidden by this operation's Scope deletion is returned by the Scope step.
	if (change(log, 'scopeDeletionOperationId')?.after === operationId) return null;
	return { kind: 'link.lifecycle', linkId: log.entityId, deleted: true };
};

const assessmentSteps = (log: Log): InverseStep[] => {
	if (log.action === 'created') return [{ kind: 'assessment.created', assessmentId: log.entityId }];
	if (log.action !== 'updated' && log.action !== 'deleted' && log.action !== 'restored') {
		return unsupported(log);
	}
	const steps: InverseStep[] = [];
	if (log.action !== 'updated') {
		steps.push({
			kind: 'assessment.lifecycle',
			assessmentId: log.entityId,
			deleted: log.action === 'deleted'
		});
	}
	const moved = ADDRESS_FIELDS.filter((field) => change(log, field));
	if (moved.length > 0) {
		if (moved.length !== ADDRESS_FIELDS.length) return unsupported(log);
		const address = (side: 'before' | 'after'): AssessmentAddress => ({
			intentionId: String(change(log, 'intentionId')![side]),
			evidenceId: String(change(log, 'evidenceId')![side]),
			activationId: String(change(log, 'activationId')![side])
		});
		steps.push({
			kind: 'assessment.placement',
			assessmentId: log.entityId,
			before: address('before'),
			after: address('after')
		});
	}
	const features: InverseStep & { kind: 'assessment.values' } = {
		kind: 'assessment.values',
		assessmentId: log.entityId,
		features: {},
		restated: []
	};
	const owner = (revision: FieldChange): string | null =>
		typeof revision.before === 'string' ? revision.before : null;
	for (const feature of ASSESSMENT_FEATURES) {
		const value = change(log, feature);
		const revision = change(log, `${feature}Revision`);
		// The journal names who owned the value before; without it the inverse cannot tell a
		// first creation from an earlier correction and is not offered.
		if (value && !revision) return unsupported(log);
		if (value && revision) features.features[feature] = { ...value, ownerBefore: owner(revision) };
		else if (revision) features.restated.push({ feature, ownerBefore: owner(revision) });
	}
	if (Object.keys(features.features).length > 0 || features.restated.length > 0) {
		steps.push(features);
	}
	return steps;
};

/**
 * The inverse of one operation as read from its journal: only the consequences the
 * operation itself recorded, in the order they will be checked. Entries outside the
 * supported families refuse the whole plan; an operation without entries is unknown here.
 */
export const planInverse = (logs: readonly Log[], operationId: string): InversePlan => {
	const own = logs.filter((log) => log.operationId === operationId);
	if (own.length === 0) {
		throw new RepositoryError('undo_unknown', 'Отменяемое действие не найдено в журнале.', {
			operationId
		});
	}
	const steps: InverseStep[] = [];
	for (const log of own) {
		// Only an ordinary action is offered back; an inverse, a restore or an import is not redone.
		if (log.cause !== 'normal') unsupported(log);
		switch (log.entityType) {
			case 'trace':
				steps.push(traceStep(log));
				break;
			case 'intersection': {
				const step = linkStep(log, operationId);
				if (step) steps.push(step);
				break;
			}
			case 'intentionAssessment':
				steps.push(...assessmentSteps(log));
				break;
			case 'scope':
				if (log.action !== 'deleted') unsupported(log);
				steps.push({ kind: 'scope.lifecycle', scopeId: log.entityId });
				break;
			default:
				unsupported(log);
		}
	}
	// A newly created evidence link is withdrawn by an inverse only as the return of a
	// transferred source from that link: a first assessment or correction of another replica
	// may still be on its way to the link, and its effect must not be taken away with it.
	for (const step of steps) {
		if (step.kind !== 'link.created' || step.linkKind !== 'evidence_for') continue;
		const returned = steps.some(
			(other) => other.kind === 'assessment.placement' && other.after.evidenceId === step.linkId
		);
		if (!returned) {
			throw new RepositoryError('undo_unsupported', UNSUPPORTED, {
				operationId,
				entityType: 'intersection',
				entityId: step.linkId,
				reason: 'evidence_link'
			});
		}
	}
	return { operationId, occurredAt: own[0].occurredAt, steps };
};
