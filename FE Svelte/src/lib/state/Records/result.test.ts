import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factFor, intentionOf } from '$lib/state/TraceDraft/results.fixture';
import { plainFields } from '$lib/state/triplit/Traces/record.fixture';
import { openDraftFixture, type DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import { RecordsReader } from './Records.svelte';

let fx: DraftFixture;
let reader: RecordsReader;
beforeEach(() => {
	fx = openDraftFixture();
	reader = new RecordsReader(fx.repository);
});
afterEach(async () => {
	await fx.dispose();
});

const read = async (traceId: string) => {
	await reader.load(traceId);
	return reader.result!.result!;
};

describe('an intention result as the Context explains it', () => {
	it('keeps a statement that only passed through an intention in that own history', async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		const c = await intentionOf(fx, 'C');
		const fact = await factFor(fx, 'Факт', a.id, { outcome: 'completed' });
		const source = fact.assessments[0].id;
		// The statement is addressed to B and then to C; B held it for a while and lost it.
		const first = await fx.repository.correctEvidenceTarget(fact.links[0].id, b.id, 'user');
		await fx.repository.correctEvidenceTarget(first.link.id, c.id, 'user');
		await reader.load(b.id);
		expect(reader.result?.result?.sources).toEqual([]);
		expect(reader.result?.pastSourceIds).toContain(source);
		// Where it came from and where it is now keep it too, each for its own reason.
		await reader.load(a.id);
		expect(reader.result?.pastSourceIds).toContain(source);
		await reader.load(c.id);
		expect(reader.result?.result?.sources.map((entry) => entry.id)).toEqual([source]);
	});

	it('decides outcome and openness separately, naming the statement behind each', async () => {
		const plan = await intentionOf(fx, 'План');
		// An earlier fact says «done», a later one says «partly»: order is time, not rank.
		await factFor(fx, 'Первый', plan.id, { outcome: 'completed' }, '2026-09-10');
		const later = await factFor(fx, 'Второй', plan.id, { outcome: 'partial' }, '2026-09-11');
		const direct = await fx.repository.createDirectAssessment(plan.id, { open: false });
		const result = await read(plan.id);
		expect([result.outcome, result.open]).toEqual(['partial', false]);
		expect(result.outcomeSourceId).toBe(later.assessments[0].id);
		// Completing an intention never closes it: the closure came from its own statement.
		expect(result.openSourceId).toBe(direct.id);
		expect(result.sources).toHaveLength(3);
		const evidence = result.sources.find((source) => source.id === later.assessments[0].id);
		expect(evidence).toMatchObject({
			kind: 'evidence',
			outcome: 'partial',
			open: null,
			effective: true,
			reason: null,
			factSummary: { title: 'Второй' }
		});
		expect(result.sources.find((source) => source.id === direct.id)).toMatchObject({
			kind: 'direct',
			outcome: null,
			open: false,
			effective: true
		});
	});

	it('keeps a statement whose fact lost its date, and says why it takes no part', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		expect((await read(plan.id)).outcome).toBe('completed');
		await fx.repository.saveTraceRecord({
			id: fact.trace.id,
			fields: { aboutKind: 'instant', aboutTime: { basis: 'unknown' }, aboutTraceId: null }
		});
		const silenced = await read(plan.id);
		expect([silenced.outcome, silenced.outcomeSourceId]).toEqual([null, null]);
		expect(silenced.sources[0]).toMatchObject({
			id: fact.assessments[0].id,
			effective: false,
			reason: 'fact_undated',
			outcome: 'completed'
		});
		// The date returns: the same statement stands again, with its first time kept.
		await fx.repository.saveTraceRecord({
			id: fact.trace.id,
			fields: {
				aboutKind: 'instant',
				aboutTime: {
					basis: 'absolute',
					precision: 'day',
					certainty: 'exact',
					start: '2026-09-11',
					end: null
				},
				aboutTraceId: null
			}
		});
		const restored = await read(plan.id);
		expect(restored.outcomeSourceId).toBe(fact.assessments[0].id);
		expect(restored.sources[0].firstAssessedAt).toBe(fact.assessments[0].firstAssessedAt);
	});

	it('moves one statement to another intention and refuses a target the fact already stands for', async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		const c = await intentionOf(fx, 'C');
		const fact = await factFor(fx, 'Факт', a.id, { outcome: 'completed' });
		const source = fact.assessments[0];
		// The fact already stands for B, so moving the A statement onto B refuses as a whole.
		await fx.repository.saveTraceRecord({
			id: fact.trace.id,
			fields: {},
			links: { add: [{ kind: 'evidence_for', intentionId: b.id, assessment: { open: false } }] }
		});
		const before = await fx.repository.listIntentionAssessments(true);
		await expect(fx.repository.correctEvidenceTarget(fact.links[0].id, b.id)).rejects.toMatchObject(
			{ code: 'target_linked' }
		);
		expect(await fx.repository.listIntentionAssessments(true)).toEqual(before);
		expect((await read(a.id)).outcome).toBe('completed');
		expect((await read(b.id)).open).toBe(false);
		// Corrected onto C, the statement keeps its identity and its first time; B is untouched.
		await fx.repository.correctEvidenceTarget(fact.links[0].id, c.id);
		const moved = await read(c.id);
		expect(moved.outcomeSourceId).toBe(source.id);
		expect(moved.sources[0].firstAssessedAt).toBe(source.firstAssessedAt);
		expect((await read(a.id)).sources).toEqual([]);
		expect((await read(b.id)).open).toBe(false);
	});

	it('is null for a record that is not an intention', async () => {
		const fact = await fx.repository.saveTraceRecord({ fields: plainFields('Обычная запись') });
		await reader.load(fact.trace.id);
		expect(reader.result?.result).toBeNull();
	});
});
