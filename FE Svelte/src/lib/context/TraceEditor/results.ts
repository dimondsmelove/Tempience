import type { MessageKey } from '$lib/state/Locale/types';
import type { IntentionState } from '$lib/state/TraceDraft/results';
import type { TargetState } from '$lib/state/TraceDraft/targets';
import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';

/** The four accepted outcomes in the order the «Итог» list offers them. */
export const OUTCOME_KEYS: readonly (readonly [IntentionOutcome, MessageKey])[] = [
	['completed', 'result.completed'],
	['partial', 'result.partial'],
	['not_completed', 'result.notCompleted'],
	['alternative', 'result.alternative']
];

/** «Итог не оценён» is the absence of an outcome, never a fifth value. */
export const outcomeKey = (outcome: IntentionOutcome | null): MessageKey =>
	OUTCOME_KEYS.find(([value]) => value === outcome)?.[1] ?? 'result.unassessed';

export const openKey = (open: boolean | null): MessageKey =>
	open === false ? 'result.closedNow' : 'result.openNow';

/** What is true of a target, in the words the block shows beside it. */
export const STATE_KEYS: Record<TargetState, MessageKey> = {
	missing: 'result.missing',
	deleted: 'result.deleted',
	role: 'result.role',
	detached: 'result.detached',
	unavailable: 'result.unavailable',
	undated: 'result.needsDate'
};

/** The «Итог» control's value for the target's own input: '' untouched, 'clear' for null. */
export const outcomeControlValue = (input: {
	outcome?: IntentionOutcome | null;
}): IntentionOutcome | '' | 'clear' =>
	Object.hasOwn(input, 'outcome') ? (input.outcome ?? 'clear') : '';

export type { IntentionState };
