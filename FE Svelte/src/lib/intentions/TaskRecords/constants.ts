import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
import type { MessageKey } from '$lib/state/Locale/types';

export const SEARCH_LIMIT = 20;
export const RECORD_OUTCOME_KEYS: Record<IntentionOutcome, MessageKey> = {
	partial: 'intentions.recordPartial',
	alternative: 'intentions.recordAlternative',
	completed: 'intentions.recordCompleted',
	not_completed: 'intentions.recordNotCompleted'
};
