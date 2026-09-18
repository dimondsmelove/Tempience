import type {
	CalibrationManifest,
	CalibrationMappingGate,
	CalibrationReviewDecision,
	CandidateReview
} from '$lib/scenarios/belgrade/calibration-manifest';

export type ProposalDecision = CalibrationReviewDecision;

/** A manifest under review: candidates before Apply, their decisions, and what has been applied (DP15, DP16). */
export type ProposalSet = Readonly<{
	manifest: CalibrationManifest;
	reviews: Readonly<Record<string, CandidateReview>>;
	applied: readonly string[];
	importedAt: string;
}>;

export type ProposalItem = Readonly<{
	candidateId: string;
	/** Preview id of the record on the ribbon. */
	traceId: string;
	content: string;
	decision: ProposalDecision;
	note: string;
	gate: CalibrationMappingGate;
	reason: string | null;
	claimRefs: readonly string[];
	scopeNames: readonly string[];
}>;

export type ProposalCounts = Readonly<{
	pending: number;
	accepted: number;
	deferred: number;
	excluded: number;
	applied: number;
}>;
