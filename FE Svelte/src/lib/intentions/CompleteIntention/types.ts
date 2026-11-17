export type CompleteOptions = { now: number; zone: string };
export type CompleteResult =
	| { ok: true; factId: string; operationId: string }
	| {
			ok: false;
			reason:
				'not_found' | 'not_intention' | 'closed' | 'typed_unsupported' | 'later_result_exists';
	  };

export type RevertCompletionResult =
	{ ok: true } | { ok: false; reason: 'not_found' | 'not_a_completion' };
