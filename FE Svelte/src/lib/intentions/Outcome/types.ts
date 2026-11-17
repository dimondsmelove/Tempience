export type OutcomeOptions = { now: number; zone: string };

/** Outcomes that are recorded with a fact saying what was done. */
export type ResultOutcome = 'partial' | 'alternative';

export type OutcomeFailure =
	'not_found' | 'not_intention' | 'text_required' | 'later_result_exists' | 'unchanged';

export type OutcomeRefusal = { ok: false; reason: OutcomeFailure };

/** `operationId` is the journalled operation an Undo offer names. */
export type OutcomeResult =
	{ ok: true; operationId: string; factId: string | null } | OutcomeRefusal;
