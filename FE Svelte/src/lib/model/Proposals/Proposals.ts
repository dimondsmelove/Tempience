import {
	initialCandidateReviews,
	parseCalibrationManifest,
	type CalibrationCandidate,
	type CandidateReview
} from '$lib/scenarios/belgrade/calibration-manifest';
import { stableEntityId, type ScenarioImportReview } from '$lib/scenarios/belgrade/scenario-import';
import type {
	ExplorerIntersection,
	ExplorerPeriod,
	ExplorerScope,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';
import { PROPOSAL_ID_PREFIX, PROPOSAL_ORIGIN_KIND } from './constants';
import type { ProposalCounts, ProposalDecision, ProposalItem, ProposalSet } from './types';

export const previewId = (manifestId: string, candidateId: string): string =>
	`${PROPOSAL_ID_PREFIX}${encodeURIComponent(manifestId)}:${encodeURIComponent(candidateId)}`;

export const parsePreviewId = (
	id: string
): Readonly<{ manifestId: string; candidateId: string }> | null => {
	if (!id.startsWith(PROPOSAL_ID_PREFIX)) return null;
	const [manifestId, candidateId] = id.slice(PROPOSAL_ID_PREFIX.length).split(':');
	if (!manifestId || !candidateId) return null;
	return {
		manifestId: decodeURIComponent(manifestId),
		candidateId: decodeURIComponent(candidateId)
	};
};

/** A manifest file becomes a proposal set with every candidate pending (DP19). */
export const importProposalSet = (json: string, importedAt: string): ProposalSet => {
	const manifest = parseCalibrationManifest(JSON.parse(json));
	return { manifest, reviews: initialCandidateReviews(manifest), applied: [], importedAt };
};

/** Restores a checkpoint written by `JSON.stringify(set)`; anything malformed is dropped. */
export const parseProposalSet = (value: unknown): ProposalSet | null => {
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	try {
		const manifest = parseCalibrationManifest(record.manifest);
		const initial = initialCandidateReviews(manifest);
		const stored =
			typeof record.reviews === 'object' && record.reviews !== null
				? (record.reviews as Record<string, Partial<CandidateReview>>)
				: {};
		const reviews: Record<string, CandidateReview> = {};
		for (const [candidateId, review] of Object.entries(initial)) {
			const decision = stored[candidateId]?.decision;
			reviews[candidateId] = {
				decision:
					decision === 'accepted' || decision === 'deferred' || decision === 'excluded'
						? decision
						: review.decision,
				note: typeof stored[candidateId]?.note === 'string' ? stored[candidateId].note! : ''
			};
		}
		const applied = Array.isArray(record.applied)
			? record.applied.filter((id): id is string => typeof id === 'string')
			: [];
		const importedAt =
			typeof record.importedAt === 'string' ? record.importedAt : new Date(0).toISOString();
		return { manifest, reviews, applied, importedAt };
	} catch {
		return null;
	}
};

const decisionOf = (set: ProposalSet, candidateId: string): ProposalDecision =>
	set.reviews[candidateId]?.decision ?? 'pending';

/** Candidates still on the table: neither excluded nor applied. */
const openCandidates = (set: ProposalSet): CalibrationCandidate[] => {
	const applied = new Set(set.applied);
	return set.manifest.candidates.filter(
		(candidate) =>
			!applied.has(candidate.candidateId) && decisionOf(set, candidate.candidateId) !== 'excluded'
	);
};

/**
 * The preview projection of the open candidates as snapshot records (DP15).
 * Scopes and periods that already exist in `live` under their stable id are
 * reused, so proposals land in the rows the user already has.
 */
export const proposalSnapshot = (set: ProposalSet, live: ExplorerSnapshot): ExplorerSnapshot => {
	const { manifestId } = set.manifest;
	const origin = { kind: PROPOSAL_ORIGIN_KIND, sourceId: manifestId };
	const liveIds = new Set([
		...live.scopes.map((scope) => scope.id),
		...live.periods.map((period) => period.id),
		...live.traces.map((trace) => trace.id)
	]);
	const idOf = new Map<string, string>();
	const scopes: ExplorerScope[] = [];
	const periods: ExplorerPeriod[] = [];
	const traces: ExplorerTrace[] = [];
	const open = openCandidates(set);
	for (const candidate of open) {
		const stable = stableEntityId(manifestId, candidate.candidateId);
		const preview = previewId(manifestId, candidate.candidateId);
		if (candidate.role === 'scope') {
			if (liveIds.has(stable)) idOf.set(candidate.candidateId, stable);
			else {
				idOf.set(candidate.candidateId, preview);
				scopes.push({ id: preview, ...candidate.proposed, origin });
			}
		} else if (candidate.role === 'period') {
			if (liveIds.has(stable)) idOf.set(candidate.candidateId, stable);
			else {
				idOf.set(candidate.candidateId, preview);
				periods.push({ id: preview, ...candidate.proposed, origin });
			}
		} else if (candidate.role === 'trace') {
			// An applied record we do not track any more is not proposed twice.
			if (liveIds.has(stable)) continue;
			idOf.set(candidate.candidateId, preview);
			traces.push({
				id: preview,
				content: candidate.proposed.content,
				relation: candidate.proposed.relation,
				timezone: candidate.proposed.timezone,
				aboutKind: candidate.proposed.aboutKind,
				aboutTime: candidate.proposed.aboutTime,
				aboutTraceId: null,
				kindId: null,
				kindVId: null,
				data: null,
				origin
			});
		}
	}
	const intersections: ExplorerIntersection[] = [];
	for (const candidate of open) {
		if (candidate.role !== 'intersection') continue;
		const fromId = idOf.get(candidate.proposed.fromId);
		const toId = idOf.get(candidate.proposed.toId);
		if (!fromId || !toId) continue;
		intersections.push({
			id: previewId(manifestId, candidate.candidateId),
			fromId,
			toId,
			kind: candidate.proposed.kind,
			context: candidate.proposed.context,
			origin
		});
	}
	return { traces, scopes, periods, intersections, scopeSegments: [] };
};

/** Decision of every proposed record on the ribbon, keyed by its preview id. */
export const proposalDecisions = (set: ProposalSet): ReadonlyMap<string, ProposalDecision> =>
	new Map(
		openCandidates(set)
			.filter((candidate) => candidate.role === 'trace')
			.map((candidate) => [
				previewId(set.manifest.manifestId, candidate.candidateId),
				decisionOf(set, candidate.candidateId)
			])
	);

export const proposalItems = (set: ProposalSet): ProposalItem[] => {
	const { manifestId } = set.manifest;
	const scopeName = new Map(
		set.manifest.candidates
			.filter((candidate) => candidate.role === 'scope')
			.map((candidate) => [candidate.candidateId, candidate.proposed.name])
	);
	const scopesOf = new Map<string, string[]>();
	for (const candidate of set.manifest.candidates) {
		if (candidate.role !== 'intersection' || candidate.proposed.kind !== 'belongs_to') continue;
		const name = scopeName.get(candidate.proposed.toId);
		if (!name) continue;
		const list = scopesOf.get(candidate.proposed.fromId) ?? [];
		list.push(name);
		scopesOf.set(candidate.proposed.fromId, list);
	}
	return openCandidates(set)
		.filter((candidate) => candidate.role === 'trace')
		.map((candidate) => ({
			candidateId: candidate.candidateId,
			traceId: previewId(manifestId, candidate.candidateId),
			content: candidate.proposed.content,
			decision: decisionOf(set, candidate.candidateId),
			note: set.reviews[candidate.candidateId]?.note ?? '',
			gate: candidate.gate,
			reason: candidate.reason,
			claimRefs: candidate.claimRefs,
			scopeNames: scopesOf.get(candidate.candidateId) ?? []
		}));
};

export const decide = (
	set: ProposalSet,
	candidateIds: readonly string[],
	decision: ProposalDecision,
	note?: string
): ProposalSet => {
	const reviews = { ...set.reviews };
	for (const candidateId of candidateIds) {
		reviews[candidateId] = {
			decision,
			note: note ?? reviews[candidateId]?.note ?? ''
		};
	}
	return { ...set, reviews };
};

export const proposalCounts = (set: ProposalSet): ProposalCounts => {
	const counts = { pending: 0, accepted: 0, deferred: 0, excluded: 0, applied: 0 };
	const applied = new Set(set.applied);
	for (const candidate of set.manifest.candidates) {
		if (candidate.role !== 'trace') continue;
		if (applied.has(candidate.candidateId)) counts.applied += 1;
		else counts[decisionOf(set, candidate.candidateId)] += 1;
	}
	return counts;
};

/**
 * The review that Apply hands to scenario-import (DP18): accepted records,
 * the Scopes they belong to with their parents, the links among them;
 * everything else is deferred so it stays a proposal.
 */
export const applyReview = (
	set: ProposalSet
): Readonly<{ review: ScenarioImportReview; candidateIds: readonly string[] }> => {
	const applied = new Set(set.applied);
	const chosen = new Set(
		set.manifest.candidates
			.filter(
				(candidate) =>
					candidate.role === 'trace' &&
					!applied.has(candidate.candidateId) &&
					decisionOf(set, candidate.candidateId) === 'accepted'
			)
			.map((candidate) => candidate.candidateId)
	);
	const links = set.manifest.candidates.filter((candidate) => candidate.role === 'intersection');
	let grew = true;
	while (grew) {
		grew = false;
		for (const link of links) {
			if (link.role !== 'intersection' || chosen.has(link.candidateId)) continue;
			const { fromId, toId, kind } = link.proposed;
			const dependency =
				(kind === 'belongs_to' || kind === 'child_of') && chosen.has(fromId) && !chosen.has(toId);
			const between = chosen.has(fromId) && chosen.has(toId);
			if (dependency || between) {
				if (dependency) chosen.add(toId);
				chosen.add(link.candidateId);
				grew = true;
			}
		}
	}
	const reviews: Record<string, CandidateReview> = {};
	for (const candidate of set.manifest.candidates) {
		const note = set.reviews[candidate.candidateId]?.note ?? '';
		reviews[candidate.candidateId] = {
			decision: chosen.has(candidate.candidateId) ? 'accepted' : 'deferred',
			note
		};
	}
	return { review: { candidates: set.manifest.candidates, reviews }, candidateIds: [...chosen] };
};

export const markApplied = (set: ProposalSet, candidateIds: readonly string[]): ProposalSet => ({
	...set,
	applied: [...new Set([...set.applied, ...candidateIds])]
});
