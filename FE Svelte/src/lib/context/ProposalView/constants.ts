import type { CalibrationMappingGate } from '$lib/scenarios/belgrade/calibration-manifest';
import type { ProposalDecision } from '$lib/model/Proposals/types';
import type { MessageKey } from '$lib/state/Locale/types';

/** Review decisions in the order the panel offers them (DP18). */
export const DECISIONS: readonly (readonly [ProposalDecision, MessageKey])[] = [
	['accepted', 'proposal.accept'],
	['deferred', 'proposal.defer'],
	['excluded', 'proposal.exclude']
];

export const GATE_KEYS: Readonly<Record<CalibrationMappingGate, MessageKey>> = {
	mapped: 'proposal.gate_mapped',
	'review-required': 'proposal.gate_review',
	deferred: 'proposal.gate_deferred'
};
