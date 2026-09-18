import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import { traceRecordText } from './fields';
import {
	dayTime,
	minuteTime,
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

const memberships = async (traceId: string, includeDeleted = false) => {
	const scopes = new Map((await repo.listScopes(true)).map((scope) => [scope.id, scope.name]));
	return (await repo.listIntersections(includeDeleted))
		.filter((link) => link.fromId === traceId && link.kind === 'belongs_to')
		.map((link) => [link.toId, link.isDeleted] as const)
		.toSorted((left, right) => scopes.get(left[0])!.localeCompare(scopes.get(right[0])!));
};

const operationLogs = async (operationId: string) =>
	(await repo.listLogs())
		.filter((log) => log.operationId === operationId)
		.map((log) => `${log.entityType}:${log.action}`)
		.toSorted();

describe('saveTraceRecord — create', () => {
	it('creates a plain record with title, description and memberships in one operation', async () => {
		open();
		const a = await repo.createScope({ name: 'A' });
		const b = await repo.createScope({ name: 'B' });
		const result = await repo.saveTraceRecord({
			fields: plainFields(' Прогулка ', { description: ' по парку ' }),
			memberships: { add: [a.id, b.id, a.id] }
		});
		expect(result.trace).toMatchObject({
			content: 'Прогулка',
			description: 'по парку',
			relation: 'actual',
			kindId: null,
			createdAt: result.operation.timestamp
		});
		expect(traceRecordText(result.trace)).toEqual({ title: 'Прогулка', description: 'по парку' });
		expect(result.links).toEqual([]);
		expect(result.assessments).toEqual([]);
		expect(await memberships(result.trace.id)).toEqual([
			[a.id, false],
			[b.id, false]
		]);
		expect(await operationLogs(result.operation.id)).toEqual([
			'intersection:linked',
			'intersection:linked',
			'trace:created'
		]);
		expect((await repo.listTraces()).map((trace) => trace.id)).toEqual([result.trace.id]);
	});

	it('accepts a record without any Scope and refuses a missing Scope without writing', async () => {
		open();
		const none = await repo.saveTraceRecord({ fields: plainFields('Без Scope') });
		expect(await memberships(none.trace.id)).toEqual([]);
		const before = await snapshotOf(repo);
		await expect(
			repo.saveTraceRecord({
				fields: plainFields('Сирота'),
				memberships: { add: ['scope:missing'] }
			})
		).rejects.toThrow();
		expect(await snapshotOf(repo)).toEqual(before);
	});

	it('requires the plain title, refuses a typed title and keeps the typed description in content', async () => {
		open();
		const { kind, kindV } = await repo.createTraceKind({
			name: 'Замер',
			initialKindV: {
				dataSchema: {
					type: 'object',
					additionalProperties: false,
					required: ['weight'],
					properties: { weight: { type: 'number' } }
				}
			}
		});
		const typed = { kindId: kind.id, kindVId: kindV.id, data: { weight: 74 } };
		expect(await outcome(repo.saveTraceRecord({ fields: plainFields('  ') }))).toBe(
			'title_required'
		);
		expect(await outcome(repo.saveTraceRecord({ fields: plainFields('Замер', typed) }))).toBe(
			'typed_title'
		);
		const blank = await repo.saveTraceRecord({ fields: plainFields('', typed) });
		expect(blank.trace).toMatchObject({ content: '', description: null, kindId: kind.id });
		expect(traceRecordText(blank.trace)).toEqual({ title: null, description: null });
		const described = await repo.saveTraceRecord({
			fields: plainFields(null, { ...typed, description: ' после сна ' })
		});
		expect(described.trace).toMatchObject({ content: 'после сна', description: null });
		expect(traceRecordText(described.trace)).toEqual({ title: null, description: 'после сна' });
		expect(await repo.listTraces()).toHaveLength(2);
	});

	it('requires the capture fields of a new record', async () => {
		open();
		expect(
			await outcome(
				repo.saveTraceRecord({ fields: { ...plainFields('Без времени'), capturedAt: undefined } })
			)
		).toBe('record_fields');
		expect(await repo.listTraces()).toEqual([]);
	});
});

describe('saveTraceRecord — edit', () => {
	it('edits text and memberships as explicit deltas and pins the Kind', async () => {
		open();
		const a = await repo.createScope({ name: 'A' });
		const b = await repo.createScope({ name: 'B' });
		const created = await repo.saveTraceRecord({
			fields: plainFields('Прогулка'),
			memberships: { add: [a.id] }
		});
		const edited = await repo.saveTraceRecord({
			id: created.trace.id,
			fields: { title: 'Пробежка', description: 'утром' },
			memberships: { add: [b.id], remove: [a.id] }
		});
		expect(edited.trace).toMatchObject({
			id: created.trace.id,
			content: 'Пробежка',
			description: 'утром',
			aboutTime: dayTime('2026-09-11'),
			updatedAt: edited.operation.timestamp
		});
		expect(edited.operation.id).not.toBe(created.operation.id);
		expect(await memberships(created.trace.id, true)).toEqual([
			[a.id, true],
			[b.id, false]
		]);
		expect(await operationLogs(edited.operation.id)).toEqual([
			'intersection:deleted',
			'intersection:linked',
			'trace:updated'
		]);
		expect(
			await outcome(
				repo.saveTraceRecord({ id: created.trace.id, fields: { kindId: null, kindVId: null } })
			)
		).toBe('kind_pinned');
		const unchanged = await repo.saveTraceRecord({ id: created.trace.id, fields: {} });
		expect(unchanged.trace).toEqual(edited.trace);
		expect(await operationLogs(unchanged.operation.id)).toEqual([]);
	});

	it('removes one membership without resubmitting the others', async () => {
		open();
		const a = await repo.createScope({ name: 'A' });
		const b = await repo.createScope({ name: 'B' });
		const created = await repo.saveTraceRecord({
			fields: plainFields('Прогулка'),
			memberships: { add: [a.id, b.id] }
		});
		const removed = await repo.saveTraceRecord({
			id: created.trace.id,
			fields: {},
			memberships: { remove: [a.id] }
		});
		expect(await memberships(created.trace.id, true)).toEqual([
			[a.id, true],
			[b.id, false]
		]);
		expect(await operationLogs(removed.operation.id)).toEqual(['intersection:deleted']);
		// Removing it again is idempotent; a membership that never existed is refused.
		const again = await repo.saveTraceRecord({
			id: created.trace.id,
			fields: {},
			memberships: { remove: [a.id] }
		});
		expect(await operationLogs(again.operation.id)).toEqual([]);
		await expect(
			repo.saveTraceRecord({
				id: created.trace.id,
				fields: {},
				memberships: { remove: ['scope:never'] }
			})
		).rejects.toThrow();
	});
});

describe('saveTraceRecord — manual intention date', () => {
	it('refuses a new past date, allows none and a future one, and keeps an equal original', async () => {
		open();
		const intend = (start: string) =>
			plainFields('Взвеситься', { relation: 'intend', aboutTime: dayTime(start) });
		expect(await outcome(repo.saveTraceRecord({ fields: intend('2020-01-01') }))).toBe(
			'intention_time_past'
		);
		expect(await repo.listTraces()).toEqual([]);
		const future = await repo.saveTraceRecord({ fields: intend('2100-01-01') });
		const undated = await repo.saveTraceRecord({
			fields: plainFields('Когда-нибудь', { relation: 'intend', aboutTime: { basis: 'unknown' } })
		});
		expect([future.trace.relation, undated.trace.relation]).toEqual(['intend', 'intend']);
		// A record saved by a previous build keeps its past date while the final value is the same time.
		const legacy = await repo.createTrace(
			plainDraft('Старое намерение', 'intend', minuteTime('2020-01-01T08:00:00.000Z'))
		);
		const same = await repo.saveTraceRecord({
			id: legacy.id,
			fields: {
				title: 'Старое намерение (правка)',
				aboutTime: minuteTime('2020-01-01T08:00:00.000Z')
			}
		});
		expect(same.trace).toMatchObject({
			content: 'Старое намерение (правка)',
			aboutTime: minuteTime('2020-01-01T08:00:00.000Z')
		});
		// The same instant spelled differently is still the original time.
		expect(
			await outcome(
				repo.saveTraceRecord({
					id: legacy.id,
					fields: { aboutTime: minuteTime('2020-01-01T10:00+02:00') }
				})
			)
		).toBe('accepted');
		expect(
			await outcome(
				repo.saveTraceRecord({
					id: legacy.id,
					fields: { aboutTime: minuteTime('2020-01-02T08:00Z') }
				})
			)
		).toBe('intention_time_past');
		expect(
			await outcome(
				repo.saveTraceRecord({ id: legacy.id, fields: { aboutTime: { basis: 'unknown' } } })
			)
		).toBe('accepted');
	});

	it('keeps a fact date when the relation switches to an intention, and leaves facts alone', async () => {
		open();
		const fact = await repo.saveTraceRecord({
			fields: plainFields('Прогулка', { aboutTime: dayTime('2020-01-01') })
		});
		const switched = await repo.saveTraceRecord({
			id: fact.trace.id,
			fields: { relation: 'intend' }
		});
		expect(switched.trace).toMatchObject({ relation: 'intend', aboutTime: dayTime('2020-01-01') });
		expect(
			await outcome(
				repo.saveTraceRecord({ id: fact.trace.id, fields: { aboutTime: dayTime('2020-01-02') } })
			)
		).toBe('intention_time_past');
		const back = await repo.saveTraceRecord({
			id: fact.trace.id,
			fields: { relation: 'actual', aboutTime: dayTime('2020-01-02') }
		});
		expect(back.trace).toMatchObject({ relation: 'actual', aboutTime: dayTime('2020-01-02') });
	});
});
