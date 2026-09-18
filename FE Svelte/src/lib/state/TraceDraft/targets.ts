import type {
	IntentionAssessmentValues,
	IntentionOutcome
} from '$lib/state/triplit/IntentionAssessments/types';
import type { TraceRecordLinkInput, TraceRecordSave } from '$lib/state/triplit/Traces/record';
import type { ResultRow, ResultRole } from './results';
import type { DraftIssue, DraftValues, EvidenceRole, ResultTarget } from './types';

export const EMPTY_INPUT: IntentionAssessmentValues = Object.freeze({});

/** The role of the edited record's results block: a fact names intentions, an intention facts. */
export const resultRole = (relation: string | null): ResultRole =>
	relation === 'intend' ? 'fact' : 'intention';

/** The saved links of the record as targets: their own input starts untouched. */
export const targetsOfRoles = (roles: readonly EvidenceRole[]): ResultTarget[] =>
	roles.map((role) => ({ otherId: role.otherId, linkId: role.linkId, input: EMPTY_INPUT }));

/** Adds a record once; a target the save already knows keeps its link. */
export const addTarget = (
	targets: readonly ResultTarget[],
	otherId: string,
	baseline: readonly ResultTarget[]
): readonly ResultTarget[] => {
	if (targets.some((target) => target.otherId === otherId)) return targets;
	const known = baseline.find((target) => target.otherId === otherId);
	return [...targets, known ?? { otherId, linkId: null, input: EMPTY_INPUT }];
};

export const removeTarget = (
	targets: readonly ResultTarget[],
	otherId: string
): readonly ResultTarget[] => targets.filter((target) => target.otherId !== otherId);

/**
 * One feature of a target's own input. `undefined` leaves the feature untouched (the key
 * goes, so no serialization can read it as a clear), null removes the own value, a value
 * is stated as given even when the current state already shows it.
 */
export const setTargetFeature = (
	targets: readonly ResultTarget[],
	otherId: string,
	feature: 'outcome' | 'open',
	value: IntentionOutcome | boolean | null | undefined
): readonly ResultTarget[] =>
	targets.map((target) => {
		if (target.otherId !== otherId) return target;
		const input: IntentionAssessmentValues = { ...target.input };
		delete input[feature];
		if (value !== undefined) Object.assign(input, { [feature]: value });
		return { ...target, input };
	});

/** Whether the target carries any statement of its own. */
export const hasInput = (target: ResultTarget): boolean =>
	Object.hasOwn(target.input, 'outcome') || Object.hasOwn(target.input, 'open');

const sameInput = (left: IntentionAssessmentValues, right: IntentionAssessmentValues): boolean =>
	Object.hasOwn(left, 'outcome') === Object.hasOwn(right, 'outcome') &&
	Object.hasOwn(left, 'open') === Object.hasOwn(right, 'open') &&
	left.outcome === right.outcome &&
	left.open === right.open;

/** Same records in any order with the same own input: order is not a change. */
export const sameTargets = (
	left: readonly ResultTarget[],
	right: readonly ResultTarget[]
): boolean =>
	left.length === right.length &&
	left.every((target) => {
		const other = right.find((entry) => entry.otherId === target.otherId);
		return other !== undefined && sameInput(target.input, other.input);
	});

export type TargetContext = {
	rows: ReadonlyMap<string, ResultRow>;
	role: ResultRole;
	/** Whether the edited record has an absolute event date (its own placement, as saved). */
	dated: boolean;
	/** The saved links: a new statement on one with a current source edits it, never creates. */
	roles: readonly EvidenceRole[];
};

/** What the form says about a target beside the record; a state is not by itself a refusal. */
export type TargetState = 'missing' | 'deleted' | 'role' | 'detached' | 'unavailable' | 'undated';

/** The state of the source the saved link names, as the binding rules read it. */
const savedSource = (target: ResultTarget, context: TargetContext): EvidenceRole['source'] | null =>
	context.roles.find((entry) => entry.linkId === target.linkId)?.source ?? null;

/**
 * What is true of a target, read whether or not this save writes anything for it, so the
 * form can say it from the start: the other record must exist, be active and hold the role;
 * the link's own source must still be addressed to this link; and a statement that would
 * create a source needs a dated fact — the edited record for an intention's target, the
 * target itself for a fact's. A current source is edited in place, where the date no longer
 * matters.
 */
export const targetState = (target: ResultTarget, context: TargetContext): TargetState | null => {
	const row = context.rows.get(target.otherId);
	if (!row) return 'missing';
	if (row.trace.isDeleted) return 'deleted';
	if ((row.trace.relation === 'intend') !== (context.role === 'intention')) return 'role';
	const source = savedSource(target, context);
	if (source === 'detached') return 'detached';
	if (source === 'unavailable') return 'unavailable';
	if (source === 'current') return null;
	const factDated = context.role === 'intention' ? context.dated : row.dated;
	return factDated ? null : 'undated';
};

/**
 * States no statement can be made through at all. «undated» is not one of them: the same
 * form can still give the fact its date, so its controls stay open.
 */
const STATEMENT_BLOCKED: readonly TargetState[] = [
	'missing',
	'deleted',
	'role',
	'detached',
	'unavailable'
];

export const blocksStatement = (state: TargetState | null): boolean =>
	state !== null && STATEMENT_BLOCKED.includes(state);

/**
 * What this save cannot write, which is not the same as what is wrong with a target. An
 * existing reference this input does not touch is kept with its history whatever became of
 * the other record: it is shown, never rewritten or dropped, so an unrelated field edit is
 * not held hostage to it. A reference this input adds, and any statement this input makes,
 * must be writable.
 */
export const targetRefusal = (target: ResultTarget, context: TargetContext): TargetState | null => {
	const state = targetState(target, context);
	if (state === null) return null;
	if (target.linkId === null && blocksStatement(state)) return state;
	return hasInput(target) ? state : null;
};

const ISSUE_KEYS = {
	missing: 'draft.targetMissing',
	deleted: 'draft.targetDeleted',
	role: 'draft.targetRole',
	detached: 'draft.targetDetached',
	unavailable: 'draft.targetUnavailable',
	undated: 'draft.assessmentNeedsDate'
} as const;

/** The first refusal as the form's issue; the block shows every target's state beside it. */
export const targetIssues = (values: DraftValues, context: TargetContext): DraftIssue[] => {
	for (const target of values.targets) {
		const refusal = targetRefusal(target, context);
		if (refusal) return [{ field: 'targets', key: ISSUE_KEYS[refusal] }];
	}
	return [];
};

const linkInput = (role: ResultRole, target: ResultTarget): TraceRecordLinkInput => ({
	kind: 'evidence_for',
	...(role === 'intention' ? { intentionId: target.otherId } : { factId: target.otherId }),
	...(hasInput(target) ? { assessment: target.input } : {})
});

/** The evidence links a new record enters, each with the statement made for it. */
export const createLinks = (values: DraftValues, role: ResultRole): TraceRecordLinkInput[] =>
	values.targets.map((target) => linkInput(role, target));

/**
 * An edit's explicit deltas: links for records added, removals for saved links no longer
 * chosen, statements for saved links the user entered something for. Untouched links are
 * not resubmitted.
 */
export const editLinks = (
	values: DraftValues,
	baseline: DraftValues,
	role: ResultRole
): Pick<TraceRecordSave, 'links' | 'assessments'> => {
	const add = values.targets
		.filter((target) => target.linkId === null)
		.map((target) => linkInput(role, target));
	const remove = baseline.targets
		.filter((target) => !values.targets.some((entry) => entry.otherId === target.otherId))
		.flatMap((target) => (target.linkId ? [target.linkId] : []));
	const assessments = values.targets.flatMap((target) =>
		target.linkId !== null && hasInput(target)
			? [{ evidenceId: target.linkId, values: target.input }]
			: []
	);
	return {
		...(add.length > 0 || remove.length > 0 ? { links: { add, remove } } : {}),
		...(assessments.length > 0 ? { assessments } : {})
	};
};
