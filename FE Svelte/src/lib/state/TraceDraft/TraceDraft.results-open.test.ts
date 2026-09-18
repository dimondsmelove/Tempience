import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assessmentsOf, evidenceOf, factFor, intentionOf, stateOf } from './results.fixture';
import { openDraftFixture, operationLogs, type DraftFixture } from './TraceDraft.fixture';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const opened = async (): Promise<void> => {};

/** The serialized own input of the one target, as a command would carry it. */
const command = (input: unknown) => JSON.parse(JSON.stringify(input));

describe('TraceDraftState — the own openness of a current source', () => {
	it('is withdrawn on its own, keeping the own outcome, the link and the first time', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'partial', open: false });
		const source = saved.assessments[0];
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: 'partial', open: false });
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		expect(draft.evidenceRoles[0].own).toEqual({ outcome: 'partial', open: false });
		draft.results.setOpen(a.id, null);
		// Clearing is one explicit feature write: the outcome key is not even sent.
		expect(command(draft.values.targets[0].input)).toEqual({ open: null });
		expect(draft.dirty).toBe(true);
		await draft.save(opened);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual([
			'intentionAssessment:updated'
		]);
		const rows = await fx.repository.listIntentionAssessments(true);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			id: source.id,
			outcome: 'partial',
			open: null,
			isDeleted: false,
			firstAssessedAt: source.firstAssessedAt,
			evidenceId: source.evidenceId
		});
		// Without an own openness the intention is open again, and its outcome still stands.
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: 'partial', open: true });
		expect(await evidenceOf(fx, saved.trace.id)).toEqual([[a.id, false]]);
	});

	it('is left alone by an untouched form and set again by an explicit reopen', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'partial', open: false });
		const before = await fx.repository.listIntentionAssessments(true);
		const untouched = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		untouched.description = 'Другое описание';
		expect(command(untouched.values.targets[0].input)).toEqual({});
		await untouched.save(opened);
		expect(await operationLogs(fx, untouched.commit!.operation.id)).toEqual(['trace:updated']);
		expect(await fx.repository.listIntentionAssessments(true)).toEqual(before);
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: 'partial', open: false });
		const reopening = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		reopening.results.setOpen(a.id, true);
		expect(command(reopening.values.targets[0].input)).toEqual({ open: true });
		await reopening.save(opened);
		const rows = await assessmentsOf(fx);
		expect(rows).toEqual([
			{
				id: saved.assessments[0].id,
				source: 'evidence',
				intentionId: a.id,
				outcome: 'partial',
				open: true,
				isDeleted: false
			}
		]);
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: 'partial', open: true });
	});

	it('clears both features together when the user withdraws the whole own statement', async () => {
		const a = await intentionOf(fx, 'A');
		const saved = await factFor(fx, 'F', a.id, { outcome: 'completed', open: false });
		const draft = await fx.open({ mode: 'edit', traceId: saved.trace.id });
		draft.results.setOutcome(a.id, null);
		draft.results.setOpen(a.id, null);
		expect(command(draft.values.targets[0].input)).toEqual({ outcome: null, open: null });
		await draft.save(opened);
		// No statement stands for the source any more; the link itself is untouched.
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: null, open: true });
		expect(await evidenceOf(fx, saved.trace.id)).toEqual([[a.id, false]]);
		const rows = await fx.repository.listIntentionAssessments(true);
		expect(rows[0]).toMatchObject({ id: saved.assessments[0].id, outcome: null, open: null });
	});
});
