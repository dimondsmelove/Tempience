export type DeleteMode = 'all' | 'only';
export type DeleteOptions = { expectedDeleteIds?: readonly string[] };
export type DeleteFailure = 'not_found' | 'not_intention' | 'already_deleted' | 'plan_changed';
export type DeleteResult =
	{ ok: true; operationId: string; deletedIds: string[] } | { ok: false; reason: DeleteFailure };

export type PlanIntention = { id: string; isIntention: boolean };
export type PlanEdge = { fromId: string; toId: string };
export type DeletePlan = {
	deleteIds: string[];
	keptShared: { id: string; otherParentIds: string[] }[];
	descendantCount: number;
};
