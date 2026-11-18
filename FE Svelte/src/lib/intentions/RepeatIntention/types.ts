export type RepeatOutcome = 'completed' | 'partial' | 'alternative';
export type RepeatOptions = { now: number; zone: string };

export type RepeatFailure =
	| 'not_found'
	| 'not_intention'
	| 'closed'
	| 'later_result_exists'
	| 'typed_unsupported'
	| 'text_required'
	| 'invalid_target';

export type RepeatResult =
	| { ok: true; operationId: string; factId: string; copyId: string; copyDay: string }
	| { ok: false; reason: RepeatFailure };
