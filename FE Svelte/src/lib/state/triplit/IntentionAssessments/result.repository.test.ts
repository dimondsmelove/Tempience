import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import type { Intersection, Trace, TraceAboutTime, TraceDraft } from '../types';
import { evaluateIntention, type IntentionResult } from './result';

const clients: TriplitClient<typeof schema>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const day = (start: string, end: string | null = null): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end
});

const draft = (
	content: string,
	relation: 'intend' | 'actual',
	aboutTime: TraceAboutTime,
	extra: Partial<TraceDraft> = {}
): TraceDraft => ({
	content,
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime,
	relation,
	...extra
});

/** The calculation over the current replica exactly as a reader would assemble it. */
const evaluate = async (
	repository: TempienceRepository,
	intentionId: string
): Promise<IntentionResult> => {
	const tracesById = new Map<string, Trace>(
		(await repository.listTraces(true)).map((row) => [row.id, row])
	);
	const intersectionsById = new Map<string, Intersection>(
		(await repository.listIntersections(true)).map((row) => [row.id, row])
	);
	return evaluateIntention(intentionId, await repository.listIntentionAssessments(true), {
		tracesById,
		intersectionsById
	});
};

const setup = async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	const repository = createTriplitRepository(client);
	const intention = await repository.createTrace(
		draft('Пройти обследование', 'intend', day('2026-09-01'))
	);
	const fact = async (
		content: string,
		aboutTime: TraceAboutTime,
		extra: Partial<TraceDraft> = {}
	) => {
		const trace = await repository.createTrace(draft(content, 'actual', aboutTime, extra));
		const link = await repository.createIntersection({
			fromId: trace.id,
			toId: intention.id,
			kind: 'evidence_for'
		});
		return { trace, link };
	};
	return { client, repository, intention, fact };
};

it('follows the event date of the fact through deletion, restoration and date edits', async () => {
	const { repository, intention, fact } = await setup();
	// B is entered first although its event is later; entry order must not matter.
	const b = await fact('Прошёл УЗИ', day('2026-09-11'));
	const a = await fact('Сдал анализы', day('2026-09-10'));
	const bSource = await repository.createEvidenceAssessment(b.link.id, { outcome: 'completed' });
	const aSource = await repository.createEvidenceAssessment(a.link.id, { outcome: 'partial' });
	expect((await evaluate(repository, intention.id)).outcome).toEqual({
		value: 'completed',
		sourceId: bSource.id
	});

	await repository.setTraceDeleted(b.trace.id, true);
	expect((await evaluate(repository, intention.id)).outcome).toEqual({
		value: 'partial',
		sourceId: aSource.id
	});
	await repository.setTraceDeleted(b.trace.id, false);
	expect((await evaluate(repository, intention.id)).outcome.sourceId).toBe(bSource.id);

	// Moving A's event date past B changes the winner; clearing it silences A; restoring brings it back unchanged.
	await repository.editTrace(a.trace.id, { aboutTime: day('2026-09-13') });
	expect((await evaluate(repository, intention.id)).outcome.sourceId).toBe(aSource.id);
	await repository.editTrace(a.trace.id, { aboutTime: { basis: 'unknown' } });
	const silenced = await evaluate(repository, intention.id);
	expect(silenced.outcome.sourceId).toBe(bSource.id);
	expect(silenced.sources.find((source) => source.assessment.id === aSource.id)).toMatchObject({
		eligibility: { eligible: false, reason: 'fact_undated' },
		orderedAt: null
	});
	await repository.editTrace(a.trace.id, { aboutTime: day('2026-09-13') });
	const restored = await evaluate(repository, intention.id);
	expect(restored.outcome.sourceId).toBe(aSource.id);
	expect(restored.sources[restored.sources.length - 1].assessment.firstAssessedAt).toBe(
		aSource.firstAssessedAt
	);
});

it('orders a day interval by its known end and a stated duration by its start', async () => {
	const { repository, intention, fact } = await setup();
	const interval = await fact('Курс', day('2026-09-10', '2026-09-11'), { aboutKind: 'interval' });
	const instant = await fact('Заключение', day('2026-09-12'));
	const intervalSource = await repository.createEvidenceAssessment(interval.link.id, {
		outcome: 'completed'
	});
	const instantSource = await repository.createEvidenceAssessment(instant.link.id, {
		outcome: 'partial'
	});
	const result = await evaluate(repository, intention.id);
	expect(result.outcome.sourceId).toBe(instantSource.id);
	expect(result.sources.map((source) => source.orderedAt)).toEqual([
		'2026-09-11T00:00:00.000Z',
		'2026-09-12T00:00:00.000Z'
	]);
	// Two stated days from Sep 12 still locate the start: the Sep 12 instant remains the winner by first time.
	await repository.editTrace(interval.trace.id, {
		aboutTime: day('2026-09-12'),
		statedDuration: { amount: 2, unit: 'day' }
	});
	const withDuration = await evaluate(repository, intention.id);
	expect(withDuration.sources.map((source) => source.orderedAt)).toEqual([
		'2026-09-12T00:00:00.000Z',
		'2026-09-12T00:00:00.000Z'
	]);
	expect(withDuration.outcome.sourceId).toBe(instantSource.id);
	expect(intervalSource.firstAssessedAt < instantSource.firstAssessedAt).toBe(true);
});

it('keeps the first-assessment tie order through value corrections on the same event day', async () => {
	const { repository, intention, fact } = await setup();
	const f = await fact('F', day('2026-09-11'));
	const g = await fact('G', day('2026-09-11'));
	const fSource = await repository.createEvidenceAssessment(f.link.id, { outcome: 'completed' });
	const gSource = await repository.createEvidenceAssessment(g.link.id, {
		outcome: 'not_completed'
	});
	expect((await evaluate(repository, intention.id)).outcome.sourceId).toBe(gSource.id);
	await repository.editIntentionAssessment(fSource.id, { outcome: 'alternative' });
	const result = await evaluate(repository, intention.id);
	expect(result.outcome.sourceId).toBe(gSource.id);
	expect(result.sources[0].assessment).toMatchObject({ id: fSource.id, outcome: 'alternative' });
});

it('silences a source while its link is withdrawn, re-enables it on restore and never through a fresh link', async () => {
	const { repository, intention, fact } = await setup();
	const a = await fact('A', day('2026-09-10'));
	const aSource = await repository.createEvidenceAssessment(a.link.id, { outcome: 'partial' });
	await repository.setIntersectionDeleted(a.link.id, true);
	expect((await evaluate(repository, intention.id)).outcome).toEqual({
		value: null,
		sourceId: null
	});
	await repository.setIntersectionDeleted(a.link.id, false);
	expect((await evaluate(repository, intention.id)).outcome.sourceId).toBe(aSource.id);
	await repository.setIntersectionDeleted(a.link.id, true);
	const fresh = await repository.createIntersection({
		fromId: a.trace.id,
		toId: intention.id,
		kind: 'evidence_for'
	});
	const detached = await evaluate(repository, intention.id);
	expect(detached.outcome.sourceId).toBeNull();
	expect(detached.sources[0].eligibility).toEqual({
		eligible: false,
		reason: 'activation_mismatch'
	});
	const renewed = await repository.createEvidenceAssessment(fresh.id, { outcome: 'completed' });
	expect((await evaluate(repository, intention.id)).outcome).toEqual({
		value: 'completed',
		sourceId: renewed.id
	});
});

it('keeps an independent direct closure when evidence goes away and reveals the previous source after a clearing', async () => {
	const { repository, intention, fact } = await setup();
	const a = await fact('A', day('2026-09-10'));
	const b = await fact('B', day('2026-09-11'));
	const aSource = await repository.createEvidenceAssessment(a.link.id, {
		outcome: 'partial',
		open: true
	});
	const closure = await repository.createDirectAssessment(intention.id, { open: false });
	expect(await evaluate(repository, intention.id)).toMatchObject({
		outcome: { value: 'partial', sourceId: aSource.id },
		open: { value: false, sourceId: closure.id }
	});
	const bSource = await repository.createEvidenceAssessment(b.link.id, { outcome: 'completed' });
	expect((await evaluate(repository, intention.id)).outcome.sourceId).toBe(bSource.id);
	await repository.editIntentionAssessment(bSource.id, { outcome: null });
	expect((await evaluate(repository, intention.id)).outcome).toEqual({
		value: 'partial',
		sourceId: aSource.id
	});
	await repository.setIntersectionDeleted(a.link.id, true);
	await repository.setTraceDeleted(b.trace.id, true);
	expect(await evaluate(repository, intention.id)).toMatchObject({
		outcome: { value: null, sourceId: null },
		open: { value: false, sourceId: closure.id }
	});
});
