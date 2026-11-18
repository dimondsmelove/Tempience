import type { TraceRepository } from '$lib/state/triplit/Repository/types';
import type { RepeatOutcome, RepeatOptions } from '../RepeatIntention/types';

type RepeatCommandRepository = Pick<TraceRepository, 'repeatIntention' | 'undoOperation'>;

/** Keep the repeat result and the single journal inverse paired for the board's undo offer. */
export const repeatIntentionWithUndo = async (
	repository: RepeatCommandRepository,
	intentionId: string,
	outcome: RepeatOutcome,
	text: string,
	copyDay: string,
	options: RepeatOptions
) => {
	const result = await repository.repeatIntention(intentionId, outcome, text, copyDay, options);
	if (!result.ok) return { result, undo: null };
	return {
		result,
		undo: async () => {
			await repository.undoOperation(result.operationId, 'user');
		}
	};
};
