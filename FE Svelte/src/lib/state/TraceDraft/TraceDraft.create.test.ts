import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { traceRecordText } from '$lib/state/triplit/Traces/fields';
import { minuteTime } from '$lib/state/triplit/Traces/record.fixture';
import {
	NOW,
	membershipsOf,
	numberKind,
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

describe('TraceDraftState — new input', () => {
	it('creates a plain fact with its own id, title and separate description in one save', async () => {
		const work = await fx.scope('Работа');
		const draft = await fx.open({ mode: 'create', scopeIds: [work.id] });
		// The entry context is the baseline: nothing is dirty and nothing is decorated yet.
		expect(draft.phase).toBe('editing');
		expect(draft.dirty).toBe(false);
		expect(draft.canSave).toBe(false);
		expect(draft.issueFor('title')).toBeNull();
		draft.touch('title');
		expect(draft.issueFor('title')?.key).toBe('draft.titleRequired');
		draft.title = 'Прогулка';
		expect(draft.issueFor('title')).toBeNull();
		expect(draft.canSave).toBe(true);
		draft.description = '  Вдоль реки  ';
		const opened: string[] = [];
		await draft.save(async (id) => {
			opened.push(id);
		});
		expect(draft.phase).toBe('closed');
		expect(draft.commit?.id).toBe(opened[0]);
		const trace = (await fx.repository.getTrace(opened[0]))!;
		expect(traceRecordText(trace)).toEqual({ title: 'Прогулка', description: 'Вдоль реки' });
		expect(trace.relation).toBe('actual');
		expect(trace.capturedAt).toBe(NOW.toISOString());
		expect(trace.timezone).toBe('UTC');
		expect(trace.aboutTime).toEqual(minuteTime(NOW.toISOString()));
		expect(await membershipsOf(fx, trace.id)).toEqual([work.id]);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual([
			'intersection:linked',
			'trace:created'
		]);
	});

	it('creates a typed fact with the entry Kind, its head version, defaults and no title', async () => {
		const { kind, version } = await fx.kind('Вес', numberKind('Вес', 'weight'));
		const draft = await fx.open({ mode: 'create', kindId: kind.id });
		expect(draft.versionId).toBe(version.id);
		expect(draft.data).toEqual({ weight: 80 });
		expect(draft.values.relation).toBe('actual');
		expect(draft.dirty).toBe(false);
		expect(draft.canSave).toBe(true);
		// An intermediate native number reads as a missing value: readiness drops, nothing resets.
		draft.data.weight = undefined as never;
		expect(draft.canSave).toBe(false);
		expect(draft.issueFor('data')).toBeNull();
		draft.touch('data');
		expect(draft.issueFor('data')?.key).toBe('draft.dataInvalid');
		draft.data.weight = 81.5;
		expect(draft.issueFor('data')).toBeNull();
		await draft.save(async () => {});
		const trace = (await fx.repository.getTrace(draft.commit!.id))!;
		expect(trace.kindId).toBe(kind.id);
		expect(trace.kindVId).toBe(version.id);
		expect(trace.data).toEqual({ weight: 81.5 });
		expect(traceRecordText(trace)).toEqual({ title: null, description: null });
		expect(trace.relation).toBe('actual');
	});

	it('resets content between plain and Kind input and restores nothing on A → B → A', async () => {
		const weight = await fx.kind('Вес', numberKind('Вес', 'weight'));
		const pulse = await fx.kind('Пульс', numberKind('Пульс', 'pulse'));
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Вес утром';
		draft.description = 'после пробежки';
		draft.setRelation('intend');
		draft.chooseKind(weight.kind.id);
		expect([draft.title, draft.description]).toEqual(['', '']);
		expect(draft.data).toEqual({ weight: 80 });
		// Kind input is a fact: the intention's missing date becomes «now» like any switch to a fact.
		expect(draft.values.relation).toBe('actual');
		expect(draft.values.placement.aboutTime).toEqual(minuteTime(NOW.toISOString()));
		draft.data.weight = 79;
		draft.description = 'заметка к весу';
		draft.chooseKind(pulse.kind.id);
		expect(draft.data).toEqual({ pulse: 80 });
		expect(draft.description).toBe('заметка к весу');
		draft.chooseKind(weight.kind.id);
		expect(draft.data).toEqual({ weight: 80 });
		draft.chooseKind('');
		expect(draft.typed).toBe(false);
		expect([draft.title, draft.description, draft.values.data]).toEqual(['', '', null]);
		expect(draft.canSave).toBe(false);
	});

	it('keeps manual and entry Scopes across Kind changes and replaces only the Kind’s own', async () => {
		const [work, personal, health, sport] = await Promise.all(
			['Работа', 'Личное', 'Здоровье', 'Спорт'].map((name) => fx.scope(name))
		);
		const weight = await fx.kind('Вес', numberKind('Вес', 'weight'), [health.id]);
		const pulse = await fx.kind('Пульс', numberKind('Пульс', 'pulse'), [health.id, sport.id]);
		const draft = await fx.open({ mode: 'create', scopeIds: [work.id] });
		draft.addScope(personal.id);
		draft.chooseKind(weight.kind.id);
		expect(draft.selectedScopeIds).toEqual([work.id, personal.id, health.id]);
		draft.removeScope(health.id);
		draft.chooseKind(pulse.kind.id);
		// The explicit removal holds even though the next Kind brings the same Scope again.
		expect(draft.selectedScopeIds).toEqual([work.id, personal.id, sport.id]);
		draft.chooseKind(weight.kind.id);
		expect(draft.selectedScopeIds).toEqual([work.id, personal.id]);
		draft.addScope(health.id);
		draft.chooseKind('');
		expect(draft.selectedScopeIds).toEqual([work.id, personal.id, health.id]);
		for (const id of [work.id, personal.id, health.id]) draft.removeScope(id);
		draft.title = 'Без Scope';
		expect(draft.canSave).toBe(true);
		await draft.save(async () => {});
		expect(await membershipsOf(fx, draft.commit!.id)).toEqual([]);
	});

	it('clears the date on Факт → Намерение and assigns «now» on the way back', async () => {
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Позвонить';
		expect(draft.values.placement.aboutTime).toEqual(minuteTime(NOW.toISOString()));
		draft.setRelation('intend');
		expect(draft.values.placement).toEqual({
			aboutKind: 'instant',
			aboutTime: { basis: 'unknown' },
			aboutTraceId: null
		});
		expect(draft.canSave).toBe(true);
		draft.setRelation('actual');
		expect(draft.values.placement.aboutTime).toEqual(minuteTime(NOW.toISOString()));
		draft.setRelation('intend');
		await draft.save(async () => {});
		const trace = (await fx.repository.getTrace(draft.commit!.id))!;
		expect([trace.relation, trace.aboutTime]).toEqual(['intend', { basis: 'unknown' }]);
	});
});
