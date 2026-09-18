import { CodedError } from '$lib/model/Errors/CodedError';

export const REPOSITORY_ERROR_CODES = [
	'assessment_values',
	'assessment_exists',
	'assessment_deleted',
	'assessment_corrupt',
	'assessment_canceled',
	'evidence_kind',
	'evidence_inactive',
	'evidence_endpoint',
	'fact_role',
	'fact_deleted',
	'fact_undated',
	'intention_role',
	'intention_deleted',
	'relation_blocked',
	'target_linked',
	'source_unavailable',
	'source_detached',
	'typed_title',
	'title_required',
	'record_fields',
	'kind_pinned',
	'link_foreign',
	'intention_time_past',
	'supplement_orphan',
	'supplement_cardinality',
	'supplement_placement',
	'supplement_relation',
	'supplement_self',
	'undo_unknown',
	'undo_unsupported',
	'undo_stale',
	'undo_unavailable',
	'storage_schema'
] as const;
export type RepositoryErrorCode = (typeof REPOSITORY_ERROR_CODES)[number];

/**
 * Coded refusal of a repository command. The message is for a log or a test; the user
 * reads the interface's copy for the code (`state/Locale/errors.ts`), and `details` names
 * the concrete row or endpoint the user has to act on — a `reason` picks the variant.
 */
export class RepositoryError extends CodedError<RepositoryErrorCode> {
	constructor(code: RepositoryErrorCode, message: string, details: Record<string, unknown> = {}) {
		super(code, message, details);
		this.name = 'RepositoryError';
	}
}
