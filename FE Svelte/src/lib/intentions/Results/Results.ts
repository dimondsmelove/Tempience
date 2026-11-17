import type { ExplorerIntersection, ExplorerTrace } from '$lib/model/Snapshot/types';
import { traceEventKey } from '$lib/state/triplit/Traces/event-time';
import { compareAssessmentInstants } from '$lib/state/triplit/IntentionAssessments/read';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';

const linkedFacts = (
	id: string,
	traces: readonly ExplorerTrace[],
	links: readonly ExplorerIntersection[]
) => {
	const ids = new Set(
		links
			.filter((link) => link.kind === 'evidence_for' && link.toId === id)
			.map((link) => link.fromId)
	);
	return traces.filter((trace) => ids.has(trace.id));
};

/** One live fact per task, with only an assessment of an active link to that task. */
export const intentionRecordRows = (
	id: string,
	traces: readonly ExplorerTrace[],
	links: readonly ExplorerIntersection[],
	assessments: readonly IntentionAssessment[]
) => {
	const evidence = links.filter((link) => link.kind === 'evidence_for' && link.toId === id);
	return linkedFacts(id, traces, evidence).map((trace) => {
		const linkIds = new Set(
			evidence.filter((link) => link.fromId === trace.id).map((link) => link.id)
		);
		const assessment = assessments
			.filter(
				(item) =>
					!item.isDeleted &&
					item.source === 'evidence' &&
					item.intentionId === id &&
					item.factId === trace.id &&
					item.evidenceId !== null &&
					linkIds.has(item.evidenceId)
			)
			.toSorted(
				(a, b) =>
					compareAssessmentInstants(b.firstAssessedAt, a.firstAssessedAt) ||
					b.id.localeCompare(a.id)
			)[0];
		return {
			trace,
			outcome: assessment?.outcome === 'none' ? null : (assessment?.outcome ?? null)
		};
	});
};

/** Snapshot contains only live traces and links. Deduplicate facts with repeated evidence links. */
export const intentionResults = (
	id: string,
	traces: readonly ExplorerTrace[],
	links: readonly ExplorerIntersection[],
	assessments: readonly IntentionAssessment[]
) => {
	const facts = linkedFacts(id, traces, links);
	const factsById = new Map(facts.map((fact) => [fact.id, fact]));
	const alternative = assessments
		.filter(
			(assessment) =>
				!assessment.isDeleted &&
				assessment.intentionId === id &&
				assessment.source === 'evidence' &&
				assessment.outcome === 'alternative' &&
				assessment.factId &&
				factsById.has(assessment.factId) &&
				links.some(
					(link) =>
						link.id === assessment.evidenceId &&
						link.kind === 'evidence_for' &&
						link.fromId === assessment.factId &&
						link.toId === id
				)
		)
		.toSorted((a, b) => {
			const aFact = factsById.get(a.factId!);
			const bFact = factsById.get(b.factId!);
			const key = (fact: ExplorerTrace | undefined) =>
				fact
					? traceEventKey({
							aboutKind: fact.aboutKind,
							aboutTime: fact.aboutTime,
							statedDuration: fact.statedDuration ?? null
						})
					: null;
			const aKey = key(aFact);
			const bKey = key(bFact);
			return (
				(aKey && bKey
					? compareAssessmentInstants(bKey, aKey)
					: Number(Boolean(bKey)) - Number(Boolean(aKey))) ||
				compareAssessmentInstants(b.firstAssessedAt, a.firstAssessedAt) ||
				b.id.localeCompare(a.id)
			);
		})[0];
	return {
		count: facts.length,
		alternative:
			facts.find((fact) => fact.id === alternative?.factId)?.content.split('\n')[0] ?? null
	};
};
