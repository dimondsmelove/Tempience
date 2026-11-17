import type { MessageKey } from '$lib/state/Locale/types';
import type { TaskOutcomeChoice } from './types';

export const OUTCOMES: readonly TaskOutcomeChoice[] = [
	'none',
	'completed',
	'partial',
	'alternative',
	'not_completed'
];
export const OUTCOME_LABELS: Record<TaskOutcomeChoice, MessageKey> = {
	none: 'intentions.panelNoOutcome',
	completed: 'result.completed',
	partial: 'intentions.panelPartial',
	alternative: 'result.alternative',
	not_completed: 'result.notCompleted'
};
export const outcomeLabel = (value: TaskOutcomeChoice | null | undefined): MessageKey =>
	OUTCOME_LABELS[value ?? 'none'];
