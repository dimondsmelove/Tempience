import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dayTime, plainFields } from '$lib/state/triplit/Traces/record.fixture';
import { nowPlacement, undatedPlacement } from './placement';
import { assessmentsOf, evidenceOf, factFor, intentionOf, stateOf } from './results.fixture';
import {
	NOW,
	membershipsOf,
	openDraftFixture,
	operationLogs,
	type DraftFixture
} from './TraceDraft.fixture';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const opened = async (): Promise<void> => {};

describe('TraceDraftState — saved results of an edited record', () => {
	it('lists the saved results with their own values; a statement edits the current source in the one operation', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'partial' });
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		expect(draft.results.targets).toEqual([
			{ otherId: a.id, linkId: saved.links[0].id, input: {} }
		]);
		expect(draft.evidenceRoles[0]).toMatchObject({
			direction: 'outgoing',
			source: 'current',
			own: { outcome: 'partial', open: null }
		});
		expect(draft.dirty).toBe(false);
		draft.results.setOutcome(a.id, 'completed');
		expect(draft.dirty).toBe(true);
		await draft.save(opened);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual([
			'intentionAssessment:updated'
		]);
		const rows = await assessmentsOf(fx);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ id: saved.assessments[0].id, outcome: 'completed' });
	});

	it('removing a saved result withdraws its link; choosing it again before the save is no change', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'completed' });
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		draft.results.remove(a.id);
		expect(draft.dirty).toBe(true);
		draft.results.add(a.id);
		expect(draft.results.targets[0].linkId).toBe(saved.links[0].id);
		expect(draft.dirty).toBe(false);
		draft.results.remove(a.id);
		await draft.save(opened);
		expect(await evidenceOf(fx, saved.trace.id, true)).toEqual([[a.id, true]]);
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: null, open: true });
		expect((await assessmentsOf(fx))[0]).toMatchObject({ isDeleted: false });
	});

	it("an intention's edit links an existing fact through the same contract, leaving the fact and its Scopes alone", async () => {
		const work = await fx.scope('Работа');
		const a = await intentionOf(fx, 'A');
		const g = await fx.repository.saveTraceRecord({
			fields: plainFields('G', { aboutTime: dayTime('2026-09-12') }),
			memberships: { add: [work.id] }
		});
		const draft = await fx.open({ mode: 'edit', traceId: a.id });
		expect(draft.targetContext.role).toBe('fact');
		draft.results.add(g.trace.id);
		draft.results.setOutcome(g.trace.id, 'completed');
		expect(draft.canSave).toBe(true);
		await draft.save(opened);
		expect(await evidenceOf(fx, g.trace.id)).toEqual([[a.id, false]]);
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: 'completed', open: true });
		expect(await membershipsOf(fx, g.trace.id)).toEqual([work.id]);
		expect(await fx.repository.getTrace(g.trace.id)).toEqual(g.trace);
	});

	it('a collision with an assessment made meanwhile refuses the whole save and keeps the input', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await fx.repository.saveTraceRecord({ fields: plainFields('F') });
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		const link = await fx.repository.createIntersection({
			fromId: saved.trace.id,
			toId: a.id,
			kind: 'evidence_for'
		});
		await fx.repository.createEvidenceAssessment(link.id, { outcome: 'partial' });
		draft.title = 'F, исправленный';
		draft.results.add(a.id);
		draft.results.setOutcome(a.id, 'completed');
		await draft.save(opened);
		expect(draft.phase).toBe('editing');
		expect(draft.failure?.code).toBe('assessment_exists');
		expect(draft.title).toBe('F, исправленный');
		expect(draft.values.targets).toEqual([
			{ otherId: a.id, linkId: null, input: { outcome: 'completed' } }
		]);
		expect((await fx.repository.getTrace(saved.trace.id))?.content).toBe('F');
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: 'partial' });
	});

	it('a source silenced by removing the fact date returns with its original first time when the date returns', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'completed' });
		const before = await stateOf(fx, a.id);
		expect(before).toMatchObject({ outcome: 'completed', sourceId: saved.assessments[0].id });
		const firstAssessedAt = saved.assessments[0].firstAssessedAt;
		const undating = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		undating.time = { mode: 'chosen', chosen: undatedPlacement() };
		expect(undating.results.targets[0].input).toEqual({});
		await undating.save(opened);
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: null, sourceId: null });
		const dating = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		dating.time = { mode: 'chosen', chosen: nowPlacement(NOW) };
		await dating.save(opened);
		expect(await stateOf(fx, a.id)).toMatchObject({
			outcome: 'completed',
			sourceId: saved.assessments[0].id
		});
		const row = (await fx.repository.listIntentionAssessments()).find(
			(entry) => entry.id === saved.assessments[0].id
		);
		expect(row?.firstAssessedAt).toBe(firstAssessedAt);
		expect(await assessmentsOf(fx)).toHaveLength(1);
	});
});
