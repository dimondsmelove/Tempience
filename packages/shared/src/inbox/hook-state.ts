export type HookEnrichmentState = 'bare' | 'scoped' | 'woven' | 'interpreted';

export type HookLinkSummary = {
	memberships: number;
	relates_to: number;
	has_task_ref: boolean;
	revisit_count: number;
	has_salience_word: boolean;
};

export const computeHookEnrichmentState = (
	summary: HookLinkSummary
): HookEnrichmentState => {
	if (summary.memberships === 0) return 'bare';

	const woven =
		summary.relates_to > 0 || summary.has_task_ref || summary.revisit_count > 0;

	if (!woven) return 'scoped';

	if (summary.has_salience_word && summary.revisit_count > 0) {
		return 'interpreted';
	}

	return 'woven';
};

export type InboxStateFilter = 'needs' | 'bare' | 'scoped' | 'all';

export const inboxStateMatches = (
	state: HookEnrichmentState,
	filter: InboxStateFilter
): boolean => {
	switch (filter) {
		case 'needs':
			return state === 'bare' || state === 'scoped';
		case 'bare':
			return state === 'bare';
		case 'scoped':
			return state === 'scoped';
		case 'all':
			return true;
	}
};
