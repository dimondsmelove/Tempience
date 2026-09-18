import { insertLog } from '../Repository/log';
import type { Operation } from '../Repository/transaction';
import type { Transaction } from '../Repository/types';
import type { LogAction, LogActor } from '../types';
import { ASSESSMENT_FEATURES } from './read';
import type {
	IntentionAssessment,
	IntentionAssessmentValues,
	StoredAssessmentOverride
} from './types';

export type Overrides = Partial<
	Record<(typeof ASSESSMENT_FEATURES)[number], StoredAssessmentOverride<unknown>>
>;

/**
 * Supplied features become corrections. An edit skips features that already hold the
 * requested value; a revival keeps every supplied feature, so a delayed concurrent first
 * creation can never displace what the user restated.
 */

/**
 * Supplied features become corrections. An edit skips features that already hold the
 * requested value; a revival keeps every supplied feature, so a delayed concurrent first
 * creation can never displace what the user restated.
 */
export const correctionsFor = (
	current: IntentionAssessment,
	input: IntentionAssessmentValues,
	operation: Operation,
	skipUnchanged: boolean
): Overrides | null => {
	const overrides: Overrides = {};
	for (const feature of ASSESSMENT_FEATURES) {
		if (!Object.hasOwn(input, feature)) continue;
		const value = input[feature] ?? null;
		if (skipUnchanged && Object.is(value, current[feature])) continue;
		overrides[feature] = { value, operationId: operation.id, statement: operation.id };
	}
	return Object.keys(overrides).length === 0 ? null : overrides;
};

export const storedValues = (existing: Record<string, unknown>): Record<string, unknown> =>
	existing.values !== null && typeof existing.values === 'object'
		? (existing.values as Record<string, unknown>)
		: {};

export const assessmentFields = [
	'intentionId',
	'evidenceId',
	'activationId',
	'outcome',
	'open',
	// A restated value keeps its value but takes a new revision; the journal shows both.
	'outcomeRevision',
	'openRevision',
	'isDeleted',
	'lifecycleId'
] as const;

export const logAssessment = (
	transaction: Transaction,
	operation: Operation,
	id: string,
	actor: LogActor,
	entry: { action: LogAction; patch: Record<string, unknown> },
	cause: 'normal' | 'restore' = 'normal'
): Promise<void> =>
	insertLog(transaction, {
		operationId: operation.id,
		occurredAt: operation.timestamp,
		entityType: 'intentionAssessment',
		entityId: id,
		action: entry.action,
		patch: entry.patch,
		actor,
		cause: operation.cause ?? cause
	});
