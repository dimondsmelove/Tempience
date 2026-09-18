import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { plainFields } from '$lib/state/triplit/Traces/record.fixture';
import { assessmentsOf, evidenceOf, factFor, intentionOf } from './results.fixture';
import {
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

const opened = async (): Promise<void> => {};

/** Links from a record as [kind, toId]. */
const linksFrom = async (fx: DraftFixture, id: string) =>
	(await fx.repository.listIntersections())
		.filter((link) => link.fromId === id && link.kind !== 'belongs_to')
		.map((link) => [link.kind, link.toId] as const);

describe('TraceDraftState — Context presets', () => {
	it('«Добавить результат» starts with the intention chosen and its direct Scopes; Kind choice adds its own', async () => {
		const work = await fx.scope('Работа');
		const home = await fx.scope('Дом');
		const a = await intentionOf(fx, 'A', [work.id]);
		const { kind } = await fx.kind('Вес', numberKind('Вес', 'weight'), [home.id]);
		const draft = await fx.open({ mode: 'create', preset: { kind: 'result', intentionId: a.id } });
		expect(draft.results.targets).toEqual([{ otherId: a.id, linkId: null, input: {} }]);
		expect(draft.selectedScopeIds).toEqual([work.id]);
		expect(draft.dirty).toBe(false);
		draft.chooseKind(kind.id);
		expect(draft.selectedScopeIds.toSorted()).toEqual([home.id, work.id].toSorted());
		expect(draft.results.targets.map((target) => target.otherId)).toEqual([a.id]);
		draft.results.setOutcome(a.id, 'completed');
		await draft.save(opened);
		expect(await evidenceOf(fx, draft.commit!.id)).toEqual([[a.id, false]]);
		expect((await assessmentsOf(fx))[0]).toMatchObject({ intentionId: a.id, outcome: 'completed' });
	});

	it('«Добавить часть» of an intention starts as an undated intention in its Scopes and links only part_of', async () => {
		const work = await fx.scope('Работа');
		const a = await intentionOf(fx, 'Проект', [work.id]);
		await factFor(fx, 'Готово', a.id, { outcome: 'partial' });
		const draft = await fx.open({ mode: 'create', preset: { kind: 'part', wholeId: a.id } });
		expect(draft.relation).toBe('intend');
		expect(draft.values.placement.aboutTime).toEqual({ basis: 'unknown' });
		expect(draft.selectedScopeIds).toEqual([work.id]);
		expect(draft.values.targets).toEqual([]);
		draft.title = 'Этап';
		await draft.save(opened);
		expect(await linksFrom(fx, draft.commit!.id)).toEqual([['part_of', a.id]]);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual([
			'intersection:linked',
			'intersection:linked',
			'trace:created'
		]);
		expect(await assessmentsOf(fx)).toHaveLength(1);
	});

	it('«Добавить часть» of a fact starts as a fact at «now», switchable to an intention', async () => {
		const saved = await fx.repository.saveTraceRecord({ fields: plainFields('Поездка') });
		const draft = await fx.open({
			mode: 'create',
			preset: { kind: 'part', wholeId: saved.trace.id }
		});
		expect(draft.relation).toBe('actual');
		expect(draft.values.placement.aboutTime?.basis).toBe('absolute');
		draft.setRelation('intend');
		expect(draft.values.placement.aboutTime).toEqual({ basis: 'unknown' });
		draft.title = 'Вернуться';
		await draft.save(opened);
		expect(await linksFrom(fx, draft.commit!.id)).toEqual([['part_of', saved.trace.id]]);
		expect((await fx.repository.getTrace(draft.commit!.id))?.relation).toBe('intend');
	});

	it('«Дополнить» saves a separate actual marker with one revisits link and nothing inherited', async () => {
		const a = await intentionOf(fx, 'A');
		const original = await factFor(fx, 'Оригинал', a.id, { outcome: 'completed' });
		await fx.repository.setTraceDeleted(original.trace.id, true);
		const draft = await fx.open({
			mode: 'create',
			preset: { kind: 'supplement', originalId: original.trace.id }
		});
		expect([draft.relation, draft.kindId, draft.values.targets]).toEqual(['actual', '', []]);
		expect(draft.values.placement).toEqual({
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: null
		});
		draft.title = 'Уточнение';
		await draft.save(opened);
		const trace = await fx.repository.getTrace(draft.commit!.id);
		expect(trace).toMatchObject({
			relation: 'actual',
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: null,
			kindId: null
		});
		expect(await linksFrom(fx, draft.commit!.id)).toEqual([['revisits', original.trace.id]]);
		expect(await assessmentsOf(fx)).toHaveLength(1);
	});
});
