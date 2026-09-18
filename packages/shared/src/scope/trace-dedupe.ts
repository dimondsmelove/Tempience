import type { ScopeTraceAttachment } from '../schemas/scope-context';

export type TraceAssemblyCandidate = {
	trace_uid: string;
	attachment: ScopeTraceAttachment;
	via_task_uid?: string | null;
};

/** First candidate wins; membership beats task_ref beats membership_via_task */
const attachmentRank: Record<ScopeTraceAttachment, number> = {
	membership: 0,
	membership_via_task: 1,
	task_ref: 2
};

export const dedupeTraceCandidates = (
	candidates: TraceAssemblyCandidate[]
): TraceAssemblyCandidate[] => {
	const byUid = new Map<string, TraceAssemblyCandidate>();
	for (const candidate of candidates) {
		const existing = byUid.get(candidate.trace_uid);
		if (!existing) {
			byUid.set(candidate.trace_uid, candidate);
			continue;
		}
		if (attachmentRank[candidate.attachment] < attachmentRank[existing.attachment]) {
			byUid.set(candidate.trace_uid, candidate);
		}
	}
	return [...byUid.values()];
};
