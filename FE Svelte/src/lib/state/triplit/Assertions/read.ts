import {
	enumValue,
	nullableIsoTimestamp,
	nullableText,
	requiredText
} from '../Repository/validation';
import type {
	Assertion,
	AssertionConfidence,
	AssertionEpistemicLayer,
	AssertionReviewStatus
} from '../types';

export const assertionEpistemicLayers = [
	'source_record',
	'recollection',
	'interpretation'
] as const satisfies readonly AssertionEpistemicLayer[];

export const assertionConfidences = [
	'high',
	'medium',
	'low',
	'unknown'
] as const satisfies readonly AssertionConfidence[];

const assertionReviewStatuses = [
	'unreviewed',
	'accepted',
	'corrected',
	'rejected'
] as const satisfies readonly AssertionReviewStatus[];

export const normalizeAssertion = (value: Record<string, unknown>): Assertion => ({
	id: String(value.id),
	statement: requiredText(value.statement, 'Stored Assertion statement'),
	epistemicLayer: enumValue(
		value.epistemicLayer,
		assertionEpistemicLayers,
		'Stored Assertion epistemicLayer'
	),
	confidence: enumValue(value.confidence, assertionConfidences, 'Stored Assertion confidence'),
	reviewStatus: enumValue(
		value.reviewStatus,
		assertionReviewStatuses,
		'Stored Assertion reviewStatus'
	),
	reviewedAt: nullableIsoTimestamp(value.reviewedAt, 'Stored Assertion reviewedAt'),
	note: nullableText(value.note, 'Stored Assertion note'),
	isDeleted: Boolean(value.isDeleted),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});
