import type { MessageKey } from '$lib/state/Locale/types';
import type { SupplementState } from '$lib/state/triplit/Traces/supplement';

/** What a supplement's own state says, in the words the Context and the form show (P4). */
export const SUPPLEMENT_KEYS: Record<SupplementState['status'], MessageKey> = {
	valid: 'supplement.valid',
	intention: 'supplement.intention',
	orphan: 'supplement.orphan',
	ambiguous: 'supplement.ambiguous',
	self: 'supplement.self',
	unavailable: 'supplement.unavailable'
};
