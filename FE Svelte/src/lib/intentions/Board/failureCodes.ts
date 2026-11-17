import type { createIntention } from '../CreateIntention/CreateIntention';
import type { CompleteResult, RevertCompletionResult } from '../CompleteIntention/types';
import type { MoveResult } from '../MoveIntention/types';

type CreateResult = Awaited<ReturnType<typeof createIntention>>;
type Failure = Extract<
	CreateResult | CompleteResult | RevertCompletionResult | MoveResult,
	{ ok: false }
>['reason'];
export const intentionFailureCodes = [
	'empty',
	'parent_not_found',
	'parent_not_intention',
	'parent_closed',
	'not_found',
	'not_intention',
	'closed',
	'invalid_target',
	'typed_unsupported',
	'later_result_exists',
	'not_a_completion'
] as const satisfies readonly Failure[];
const exhaustive: Exclude<Failure, (typeof intentionFailureCodes)[number]> extends never
	? true
	: never = true;
void exhaustive;
