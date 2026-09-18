import { afterEach, expect, it } from 'vitest';
import type { Intersection, Trace } from '../types';
import { collectAssessmentContext, describeAssessmentEligibility } from './eligibility';
import { createAssessmentFixture, type AssessmentFixture } from './fixture';
import type { IntentionAssessment } from './types';

const fixtures: AssessmentFixture[] = [];
const setup = async (): Promise<AssessmentFixture> => {
	const fixture = await createAssessmentFixture();
	fixtures.push(fixture);
	return fixture;
};
afterEach(async () => {
	for (const fixture of fixtures.splice(0)) await fixture.dispose();
});

/** Eligibility from the replica as a reader would compute it, including deleted rows. */
const eligibility = async (fixture: AssessmentFixture, assessment: IntentionAssessment) => {
	const traces = new Map<string, Trace>(
		(await fixture.repository.listTraces(true)).map((trace) => [trace.id, trace])
	);
	const links = new Map<string, Intersection>(
		(await fixture.repository.listIntersections(true)).map((link) => [link.id, link])
	);
	const [current] = (await fixture.repository.listIntentionAssessments(true)).filter(
		(row) => row.id === assessment.id
	);
	return describeAssessmentEligibility(current, collectAssessmentContext(current, traces, links));
};

it('silences the source while its link is withdrawn and restores it with the same activation', async () => {
	const fixture = await setup();
	const { repository, link } = fixture;
	const assessment = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	expect(await eligibility(fixture, assessment)).toEqual({ eligible: true });
	await repository.setIntersectionDeleted(link.id, true);
	expect(await eligibility(fixture, assessment)).toEqual({
		eligible: false,
		reason: 'link_inactive'
	});
	await repository.setIntersectionDeleted(link.id, false);
	expect(await eligibility(fixture, assessment)).toEqual({ eligible: true });
	// The source itself was never rewritten: its journal only holds the creation.
	expect(await repository.listLogs(assessment.id)).toHaveLength(1);
});

it('never resurrects a withdrawn source through a fresh link with the same endpoints', async () => {
	const fixture = await setup();
	const { repository, link, fact, intention } = fixture;
	const assessment = await repository.createEvidenceAssessment(link.id, { open: false });
	await repository.setIntersectionDeleted(link.id, true);
	const fresh = await repository.createIntersection({
		fromId: fact.id,
		toId: intention.id,
		kind: 'evidence_for'
	});
	expect(fresh.id).toBe(link.id);
	expect(fresh.activationId).not.toBe(link.activationId);
	expect(await eligibility(fixture, assessment)).toEqual({
		eligible: false,
		reason: 'activation_mismatch'
	});
	// The fresh activation starts without an assessment until the user explicitly enters one.
	const renewed = await repository.createEvidenceAssessment(fresh.id, { outcome: 'partial' });
	expect(renewed.id).not.toBe(assessment.id);
	expect(await eligibility(fixture, renewed)).toEqual({ eligible: true });
	expect(await repository.listIntentionAssessments()).toHaveLength(2);
});

it('follows the fact and intention lifecycle without touching the source', async () => {
	const fixture = await setup();
	const { repository, link, fact, intention } = fixture;
	const assessment = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	await repository.setTraceDeleted(fact.id, true);
	expect(await eligibility(fixture, assessment)).toEqual({
		eligible: false,
		reason: 'fact_deleted'
	});
	await repository.setTraceDeleted(fact.id, false);
	await repository.setTraceDeleted(intention.id, true);
	expect(await eligibility(fixture, assessment)).toEqual({
		eligible: false,
		reason: 'intention_deleted'
	});
	await repository.setTraceDeleted(intention.id, false);
	expect(await eligibility(fixture, assessment)).toEqual({ eligible: true });
	await repository.setIntentionAssessmentDeleted(assessment.id, true);
	expect(await eligibility(fixture, assessment)).toEqual({ eligible: false, reason: 'deleted' });
	expect(await repository.listLogs(assessment.id)).toHaveLength(2);
});

it('treats an undated fact, wrong roles and missing rows as inactive rather than corrupt', async () => {
	const fixture = await setup();
	const { repository, link, fact, intention } = fixture;
	const assessment = await repository.createEvidenceAssessment(link.id, { outcome: 'completed' });
	const linkRow = (await repository.listIntersections(true)).find((row) => row.id === link.id);
	const context = { intention, fact, link: linkRow };
	expect(describeAssessmentEligibility(assessment, context)).toEqual({ eligible: true });
	expect(
		describeAssessmentEligibility(assessment, {
			...context,
			fact: { ...fact, aboutTime: { basis: 'unknown' } }
		})
	).toEqual({ eligible: false, reason: 'fact_undated' });
	expect(
		describeAssessmentEligibility(assessment, { ...context, fact: { ...fact, relation: 'intend' } })
	).toEqual({ eligible: false, reason: 'fact_role' });
	expect(
		describeAssessmentEligibility(assessment, {
			...context,
			intention: { ...intention, relation: 'actual' }
		})
	).toEqual({ eligible: false, reason: 'intention_role' });
	expect(describeAssessmentEligibility(assessment, { ...context, link: null })).toEqual({
		eligible: false,
		reason: 'link_missing'
	});
	expect(describeAssessmentEligibility(assessment, { ...context, fact: null })).toEqual({
		eligible: false,
		reason: 'fact_missing'
	});
	expect(describeAssessmentEligibility(assessment, { ...context, intention: null })).toEqual({
		eligible: false,
		reason: 'intention_missing'
	});
	const direct = await repository.createDirectAssessment(intention.id, { open: true });
	expect(describeAssessmentEligibility(direct, { intention })).toEqual({ eligible: true });
	expect(
		describeAssessmentEligibility(direct, { intention: { ...intention, isDeleted: true } })
	).toEqual({ eligible: false, reason: 'intention_deleted' });
});
