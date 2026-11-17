import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
import type { TaskOutcomeChoice } from './types';

export const selectOpen = (current: boolean, next: boolean, change: (open: boolean) => void) => {
	if (current !== next) change(next);
};

export const selectOutcome = (
	current: IntentionOutcome | null | undefined,
	next: TaskOutcomeChoice,
	change: (outcome: TaskOutcomeChoice) => void
) => {
	if (next === 'partial' || next === 'alternative' || (current ?? 'none') !== next) change(next);
};
