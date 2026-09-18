import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import {
	dayTime,
	openRecordFixture,
	outcome,
	plainDraft,
	plainFields,
	snapshotOf,
	type RecordFixture
} from './record.fixture';

let fixture: RecordFixture;
let repo: TempienceRepository;
afterEach(async () => {
	await fixture?.dispose();
});
const open = () => {
	fixture = openRecordFixture();
	repo = fixture.repository;
	return repo;
};

const operationLogs = async (operationId: string) =>
	(await repo.listLogs())
		.filter((log) => log.operationId === operationId)
		.map((log) => `${log.entityType}:${log.action}`)
		.toSorted();

describe('saveTraceRecord — relations and assessments', () => {
	it('links one fact to two intentions with distinct assessments in one operation', async () => {
		open();
		const a = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const b = await repo.createTrace(plainDraft('Записать вес', 'intend'));
		const result = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: {
				add: [
					{ kind: 'evidence_for', intentionId: a.id, assessment: { outcome: 'completed' } },
					{ kind: 'evidence_for', intentionId: b.id, assessment: { outcome: 'partial' } }
				]
			}
		});
		const fact = result.trace;
		expect(result.links.map((link) => [link.fromId, link.toId, link.kind])).toEqual([
			[fact.id, a.id, 'evidence_for'],
			[fact.id, b.id, 'evidence_for']
		]);
		expect(
			result.assessments.map((row) => [row.intentionId, row.outcome, row.outcomeRevision])
		).toEqual([
			[a.id, 'completed', result.operation.id],
			[b.id, 'partial', result.operation.id]
		]);
		expect(result.assessments.map((row) => row.evidenceId)).toEqual(
			result.links.map((link) => link.id)
		);
		expect(await operationLogs(result.operation.id)).toEqual([
			'intentionAssessment:created',
			'intentionAssessment:created',
			'intersection:linked',
			'intersection:linked',
			'trace:created'
		]);
		expect(await repo.listIntentionAssessments()).toHaveLength(2);
	});

	it('rolls the whole save back when the last part is invalid', async () => {
		open();
		const a = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const other = await repo.createTrace(plainDraft('Другой факт', 'actual'));
		const before = await snapshotOf(repo);
		expect(
			await outcome(
				repo.saveTraceRecord({
					fields: plainFields('80 кг'),
					links: {
						add: [
							{ kind: 'evidence_for', intentionId: a.id, assessment: { outcome: 'completed' } },
							{ kind: 'evidence_for', intentionId: other.id }
						]
					}
				})
			)
		).toBe('intention_role');
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('edits the record together with added and removed relations', async () => {
		open();
		const a = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const c = await repo.createTrace(plainDraft('Заметка', 'actual'));
		const created = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: a.id }] }
		});
		const evidence = created.links[0];
		const edited = await repo.saveTraceRecord({
			id: created.trace.id,
			fields: { title: '80,5 кг' },
			links: { add: [{ kind: 'related_to', traceId: c.id }], remove: [evidence.id] }
		});
		expect(edited.trace.content).toBe('80,5 кг');
		expect(edited.links.map((link) => [link.kind, link.isDeleted])).toEqual([
			['related_to', false],
			['evidence_for', true]
		]);
		expect(await operationLogs(edited.operation.id)).toEqual([
			'intersection:deleted',
			'intersection:linked',
			'trace:updated'
		]);
		expect((await repo.listIntersections(true)).map((link) => [link.id, link.isDeleted])).toEqual(
			expect.arrayContaining([
				[evidence.id, true],
				[edited.links[0].id, false]
			])
		);
	});

	it('refuses a foreign link and keeps the relation guard of linked intentions', async () => {
		open();
		const a = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: a.id }] }
		});
		const stranger = await repo.saveTraceRecord({ fields: plainFields('Чужая запись') });
		expect(
			await outcome(
				repo.saveTraceRecord({
					id: stranger.trace.id,
					fields: {},
					links: { remove: [fact.links[0].id] }
				})
			)
		).toBe('link_foreign');
		expect(await outcome(repo.saveTraceRecord({ id: a.id, fields: { relation: 'actual' } }))).toBe(
			'relation_blocked'
		);
		expect((await repo.listIntersections()).map((link) => link.id)).toEqual([fact.links[0].id]);
	});

	it('creates a part through part_of only, without propagating memberships or evidence', async () => {
		open();
		const scope = await repo.createScope({ name: 'Здоровье' });
		const a = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const whole = await repo.saveTraceRecord({
			fields: plainFields('Утро'),
			memberships: { add: [scope.id] },
			links: { add: [{ kind: 'evidence_for', intentionId: a.id }] }
		});
		const part = await repo.saveTraceRecord({
			fields: plainFields('Зарядка'),
			links: { add: [{ kind: 'part_of', wholeId: whole.trace.id }] }
		});
		expect(
			(await repo.listIntersections())
				.filter((link) => link.fromId === part.trace.id || link.toId === part.trace.id)
				.map((link) => [link.fromId, link.toId, link.kind])
		).toEqual([[part.trace.id, whole.trace.id, 'part_of']]);
		const before = await snapshotOf(repo);
		await expect(
			repo.saveTraceRecord({
				id: whole.trace.id,
				fields: { title: 'Утро (цикл)' },
				links: { add: [{ kind: 'part_of', wholeId: part.trace.id }] }
			})
		).rejects.toThrow('cycle');
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('assesses an existing evidence link, then edits the same source', async () => {
		open();
		const a = await repo.createTrace(plainDraft('Взвеситься', 'intend'));
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			links: { add: [{ kind: 'evidence_for', intentionId: a.id }] }
		});
		const evidenceId = fact.links[0].id;
		expect(await repo.listIntentionAssessments()).toEqual([]);
		const first = await repo.saveTraceRecord({
			id: fact.trace.id,
			fields: {},
			assessments: [{ evidenceId, values: { outcome: 'completed' } }]
		});
		expect(first.assessments).toHaveLength(1);
		expect(first.assessments[0]).toMatchObject({ evidenceId, outcome: 'completed', open: null });
		expect(await operationLogs(first.operation.id)).toEqual(['intentionAssessment:created']);
		const second = await repo.saveTraceRecord({
			id: a.id,
			fields: {},
			assessments: [{ evidenceId, values: { open: false } }]
		});
		expect(second.assessments[0]).toMatchObject({
			id: first.assessments[0].id,
			outcome: 'completed',
			open: false,
			openRevision: second.operation.id
		});
		expect(await operationLogs(second.operation.id)).toEqual(['intentionAssessment:updated']);
		const stranger = await repo.saveTraceRecord({ fields: plainFields('Чужая запись') });
		expect(
			await outcome(
				repo.saveTraceRecord({
					id: stranger.trace.id,
					fields: {},
					assessments: [{ evidenceId, values: { open: true } }]
				})
			)
		).toBe('link_foreign');
		expect(await repo.listIntentionAssessments()).toHaveLength(1);
	});

	it('never propagates evidence, Scope or dates from a fact to a dated intention it evidences', async () => {
		open();
		const scope = await repo.createScope({ name: 'Здоровье' });
		const intention = await repo.saveTraceRecord({
			fields: plainFields('Взвеситься', { relation: 'intend', aboutTime: dayTime('2100-01-01') })
		});
		const fact = await repo.saveTraceRecord({
			fields: plainFields('80 кг'),
			memberships: { add: [scope.id] },
			links: { add: [{ kind: 'evidence_for', intentionId: intention.trace.id }] }
		});
		const links = (await repo.listIntersections()).map((link) => [
			link.fromId,
			link.toId,
			link.kind
		]);
		expect(links).toHaveLength(2);
		expect(links).toEqual(
			expect.arrayContaining([
				[fact.trace.id, scope.id, 'belongs_to'],
				[fact.trace.id, intention.trace.id, 'evidence_for']
			])
		);
		expect((await repo.listTraces()).find((row) => row.id === intention.trace.id)).toEqual(
			intention.trace
		);
	});
});
