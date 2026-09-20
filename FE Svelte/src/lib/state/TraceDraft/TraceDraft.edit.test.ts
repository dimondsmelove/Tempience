import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { traceRecordText } from '$lib/state/triplit/Traces/fields';
import { dayTime, plainDraft, plainFields } from '$lib/state/triplit/Traces/record.fixture';
import {
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

describe('TraceDraftState — editing a saved Trace', () => {
	it('loads the full record as the baseline and saves only what changed to the same id', async () => {
		const work = await fx.scope('Работа');
		const home = await fx.scope('Дом');
		const { trace: saved } = await fx.repository.saveTraceRecord({
			fields: plainFields('Старое название', { description: 'Описание остаётся' }),
			memberships: { add: [work.id] }
		});
		const draft = await fx.open({ mode: 'edit', traceId: saved.id });
		expect([draft.title, draft.description, draft.relation]).toEqual([
			'Старое название',
			'Описание остаётся',
			'actual'
		]);
		expect(draft.time).toEqual({ mode: 'keep' });
		expect(draft.selectedScopeIds).toEqual([work.id]);
		expect(draft.dirty).toBe(false);
		expect(draft.canSave).toBe(false);
		draft.title = 'Новое название';
		expect(draft.canSave).toBe(true);
		// Every value back at the baseline reads as unchanged, whatever was touched.
		draft.title = 'Старое название';
		expect(draft.dirty).toBe(false);
		expect(draft.canSave).toBe(false);
		draft.title = 'Новое название';
		draft.addScope(home.id);
		draft.removeScope(work.id);
		const opened: string[] = [];
		await draft.save(async (id) => {
			opened.push(id);
		});
		expect(opened).toEqual([saved.id]);
		const after = (await fx.repository.getTrace(saved.id))!;
		expect(traceRecordText(after)).toEqual({
			title: 'Новое название',
			description: 'Описание остаётся'
		});
		expect(after.aboutTime).toEqual(saved.aboutTime);
		expect(await membershipsOf(fx, saved.id)).toEqual([home.id]);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual([
			'intersection:deleted',
			'intersection:linked',
			'trace:updated'
		]);
		expect((await fx.repository.listTraces()).map((row) => row.id)).toEqual([saved.id]);
	});

	it('lets an intention keep its past date for unrelated edits and refuses a new past date', async () => {
		// An intention whose date has since passed: the generic command stores it as history does.
		const saved = await fx.repository.createTrace(
			plainDraft('Созвон', 'intend', dayTime('2026-09-12'))
		);
		const draft = await fx.open({ mode: 'edit', traceId: saved.id });
		draft.description = 'подготовить вопросы';
		expect(draft.issues).toEqual([]);
		expect(draft.canSave).toBe(true);
		// Changing away and back: the original past placement is unchanged, so it is legal.
		draft.time = {
			mode: 'chosen',
			chosen: { aboutKind: 'instant', aboutTime: dayTime('2026-09-10'), aboutTraceId: null }
		};
		draft.touch('time');
		expect(draft.issueFor('time')?.key).toBe('draft.timePast');
		expect(draft.canSave).toBe(false);
		draft.time = {
			mode: 'chosen',
			chosen: { aboutKind: 'instant', aboutTime: dayTime('2026-09-12'), aboutTraceId: null }
		};
		expect(draft.issueFor('time')).toBeNull();
		expect(draft.canSave).toBe(true);
		await draft.save(async () => {});
		const after = (await fx.repository.getTrace(saved.id))!;
		expect(after.aboutTime).toEqual(dayTime('2026-09-12'));
		expect(after.description).toBe('подготовить вопросы');
		expect(after.relation).toBe('intend');
	});

	it('keeps a saved intention’s planned date when it is switched to a fact and back (T1)', async () => {
		// Owner review 2026-09-19: «Итог намерения» on an existing intention turned it into a fact
		// dated «now»; the planned date is the record's own and the switch must leave it alone.
		const planned = dayTime('2026-09-25');
		const saved = await fx.repository.createTrace(plainDraft('Продлить визу', 'intend', planned));
		const draft = await fx.open({ mode: 'edit', traceId: saved.id });
		expect(draft.time).toEqual({ mode: 'keep' });
		draft.setRelation('actual');
		expect(draft.relation).toBe('actual');
		expect(draft.time).toEqual({ mode: 'keep' });
		expect(draft.values.placement.aboutTime).toEqual(planned);
		expect(draft.dirty).toBe(true);
		// The way back keeps it too, and the untouched record reads as unchanged.
		draft.setRelation('intend');
		expect(draft.values.placement.aboutTime).toEqual(planned);
		expect(draft.dirty).toBe(false);
		// Saving the switch stores the fact at its planned day, not at «now».
		draft.setRelation('actual');
		await draft.save(async () => {});
		const after = (await fx.repository.getTrace(saved.id))!;
		expect([after.relation, after.aboutTime]).toEqual(['actual', planned]);
		// A saved fact switched to an intention keeps its date as well.
		const fact = await fx.repository.createTrace(
			plainDraft('Пробежка', 'actual', dayTime('2026-09-01'))
		);
		const factDraft = await fx.open({ mode: 'edit', traceId: fact.id });
		factDraft.setRelation('intend');
		expect(factDraft.values.placement.aboutTime).toEqual(dayTime('2026-09-01'));
	});

	it('keeps an old typed intention’s relation and own version; its description is the content', async () => {
		const { kind, version: first } = await fx.kind('Вес', numberKind('Вес', 'weight'));
		const next = await fx.repository.createTraceKindV(kind.id, {
			...numberKind('Вес', 'weight'),
			parentKindVIds: [first.id]
		});
		const at = '2026-09-01T08:00:00.000Z';
		await fx.client.insert('traces', {
			id: 'legacy-typed-intention',
			capturedAt: at,
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime: { basis: 'unknown' },
			aboutTraceId: null,
			content: '',
			relation: 'intend',
			kindId: kind.id,
			kindVId: first.id,
			data: { weight: 75 },
			isDeleted: false,
			createdAt: at,
			updatedAt: at
		} as never);
		const draft = await fx.open({ mode: 'edit', traceId: 'legacy-typed-intention' });
		expect(draft.diagnostic).toBeNull();
		expect([draft.relation, draft.versionId, draft.description]).toEqual(['intend', first.id, '']);
		expect(draft.version?.id).not.toBe(next.id);
		expect(draft.dirty).toBe(false);
		draft.chooseKind('');
		expect(draft.kindId).toBe(kind.id);
		draft.description = 'Заметка';
		await draft.save(async () => {});
		const after = (await fx.repository.getTrace('legacy-typed-intention'))!;
		expect(traceRecordText(after)).toEqual({ title: null, description: 'Заметка' });
		expect([after.relation, after.kindVId, after.data]).toEqual([
			'intend',
			first.id,
			{ weight: 75 }
		]);
	});

	it('shows a local diagnostic for a row whose version is missing and never rewrites it', async () => {
		const { kind } = await fx.kind('Вес', numberKind('Вес', 'weight'));
		const at = '2026-09-01T08:00:00.000Z';
		await fx.client.insert('traces', {
			id: 'typed-without-version',
			capturedAt: at,
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime: { basis: 'unknown' },
			aboutTraceId: null,
			content: '',
			relation: 'actual',
			kindId: kind.id,
			kindVId: 'kindv:gone',
			data: { weight: 75 },
			isDeleted: false,
			createdAt: at,
			updatedAt: at
		} as never);
		const draft = await fx.open({ mode: 'edit', traceId: 'typed-without-version' });
		expect(draft.diagnostic).toBe('draft.missingVersion');
		expect(draft.data).toEqual({ weight: 75 });
		draft.description = 'попытка';
		expect(draft.canSave).toBe(false);
		const missing = await fx.open({ mode: 'edit', traceId: 'trace:absent' });
		expect(missing.diagnostic).toBe('draft.missingRecord');
		expect(missing.canSave).toBe(false);
	});

	it('blocks the relation switch an evidence link forbids and names the linked record', async () => {
		const { trace: intention } = await fx.repository.saveTraceRecord({
			fields: plainFields('Пробежать 5 км', {
				relation: 'intend',
				aboutTime: dayTime('2036-09-20')
			})
		});
		const { trace: fact } = await fx.repository.saveTraceRecord({
			fields: plainFields('Пробежка'),
			links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
		});
		const factDraft = await fx.open({ mode: 'edit', traceId: fact.id });
		expect(factDraft.blockedRelation).toEqual({
			relation: 'intend',
			role: expect.objectContaining({ direction: 'outgoing', otherTitle: 'Пробежать 5 км' })
		});
		factDraft.setRelation('intend');
		expect(factDraft.relation).toBe('actual');
		expect(factDraft.dirty).toBe(false);
		const intentionDraft = await fx.open({ mode: 'edit', traceId: intention.id });
		expect(intentionDraft.blockedRelation?.relation).toBe('actual');
		expect(intentionDraft.blockedRelation?.role.otherId).toBe(fact.id);
	});
});
