import {
	samePlacement,
	validateManualIntentionTime
} from '$lib/state/triplit/Traces/intention-time';
import { assertTraceData } from '$lib/state/triplit/trace-kind-v-validation';
import type { TraceKindV } from '$lib/state/triplit/types';
import { jsonData, sameData } from './json';
import { savedPlacement, undatedPlacement } from './placement';
import { sameScopeSet } from './scopes';
import { sameTargets, targetIssues, type TargetContext } from './targets';
import type { TraceDraftState } from './TraceDraft.svelte';
import type { DraftIssue, DraftValues, TemporalPlacement, TimeDraft } from './types';

/** Text as it will be stored: trimmed, a blank description is no description. */
export const normalizeText = (value: string | null | undefined): string | null => {
	const trimmed = (value ?? '').trim();
	return trimmed.length > 0 ? trimmed : null;
};

/** The placement the save will write: the chosen one, or the record's own when kept. */
export const resolvePlacement = (
	time: TimeDraft,
	saved: TemporalPlacement | null
): TemporalPlacement | null => (time.mode === 'chosen' ? time.chosen : saved);

/**
 * The final values of the open form: a new Kind input is a fact whatever the relation
 * control held before, the kept time is the record's own, plain input has no data.
 */
export const currentValues = (draft: TraceDraftState): DraftValues => ({
	title: draft.title,
	description: draft.description,
	relation: draft.typed && draft.entry.mode === 'create' ? 'actual' : draft.relation,
	placement: resolvePlacement(draft.time, savedPlacement(draft.saved)) ?? undatedPlacement(),
	kindId: draft.kindId || null,
	versionId: draft.versionId || null,
	data: draft.typed ? draft.data : null,
	scopeIds: draft.selectedScopeIds,
	targets: draft.results.targets
});

/**
 * Whether the final values differ from the baseline: compared as values, never by which
 * control was touched, so returning everything to the baseline reads as unchanged. Typed
 * data compares as the JSON it would store, so a cleared optional field equals an absent one.
 */
export const sameValues = (left: DraftValues, right: DraftValues): boolean =>
	left.title.trim() === right.title.trim() &&
	normalizeText(left.description) === normalizeText(right.description) &&
	left.relation === right.relation &&
	samePlacement(left.placement, right.placement) &&
	left.kindId === right.kindId &&
	left.versionId === right.versionId &&
	sameData(left.data, right.data) &&
	sameScopeSet(left.scopeIds, right.scopeIds) &&
	sameTargets(left.targets, right.targets);

export type IssueContext = {
	typed: boolean;
	version: TraceKindV | null;
	baseline: DraftValues | null;
	/** Controls whose text the browser could not parse (native `badInput`), reported by the form. */
	nativeInvalid?: number;
	now?: number;
	/** The chosen results' records and links, so a target's problem blocks the save. */
	targets?: TargetContext;
};

/** The typed data's reasons: unfinished native text, incomplete JSON, then the schema. */
const dataIssue = (values: DraftValues, context: IssueContext): DraftIssue | null => {
	if ((context.nativeInvalid ?? 0) > 0) return { field: 'data', key: 'draft.dataUnfinished' };
	const json = jsonData(values.data);
	if (!json.ok) return { field: 'data', key: 'draft.dataIncomplete', detail: json.path };
	try {
		assertTraceData(json.value, context.version!.dataSchema);
		return null;
	} catch (cause) {
		return {
			field: 'data',
			key: 'draft.dataInvalid',
			detail: cause instanceof Error ? cause.message : String(cause)
		};
	}
};

/**
 * Every reason the values cannot be saved yet: the plain title, the typed version and its
 * data (checked by the same validator the repository uses, after the JSON reading of the
 * form's partial value), and the accepted manual intention time rule with the record's own
 * saved placement as the original.
 */
export const draftIssues = (values: DraftValues, context: IssueContext): DraftIssue[] => {
	const issues: DraftIssue[] = [];
	if (!context.typed) {
		if (values.title.trim().length === 0)
			issues.push({ field: 'title', key: 'draft.titleRequired' });
	} else if (!context.version) {
		issues.push({ field: 'version', key: 'draft.versionRequired' });
	} else {
		const issue = dataIssue(values, context);
		if (issue) issues.push(issue);
	}
	const check = validateManualIntentionTime(
		context.baseline?.placement ?? null,
		{ relation: values.relation, ...values.placement },
		context.now
	);
	if (!check.ok) issues.push({ field: 'time', key: 'draft.timePast' });
	if (context.targets) issues.push(...targetIssues(values, context.targets));
	return issues;
};
