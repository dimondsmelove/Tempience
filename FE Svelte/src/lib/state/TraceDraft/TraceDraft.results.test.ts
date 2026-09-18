import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resultCandidates } from './results';
import { assessmentsOf, evidenceOf, intentionOf, stateOf } from './results.fixture';
import { undatedPlacement } from './placement';
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

const opened = async (id: string): Promise<void> => {
	void id;
};

describe('TraceDraftState — «Результат для» of a new fact', () => {
	it('links several intentions with their own statements in one operation; untouched input writes nothing', async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		const c = await intentionOf(fx, 'C');
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Отчёт';
		draft.results.add(a.id);
		draft.results.setOutcome(a.id, 'completed');
		draft.results.add(b.id);
		draft.results.setOpen(b.id, false);
		draft.results.add(c.id);
		expect(draft.values.targets.map((target) => [target.otherId, target.input])).toEqual([
			[a.id, { outcome: 'completed' }],
			[b.id, { open: false }],
			[c.id, {}]
		]);
		await draft.save(opened);
		expect(draft.commit).not.toBeNull();
		const logs = await operationLogs(fx, draft.commit!.operation.id);
		expect(logs).toEqual([
			'intentionAssessment:created',
			'intentionAssessment:created',
			'intersection:linked',
			'intersection:linked',
			'intersection:linked',
			'trace:created'
		]);
		expect(await evidenceOf(fx, draft.commit!.id)).toEqual(
			[a.id, b.id, c.id].toSorted().map((id) => [id, false])
		);
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: 'completed', open: true });
		expect(await stateOf(fx, b.id)).toMatchObject({ outcome: null, open: false });
		expect(await stateOf(fx, c.id)).toMatchObject({ outcome: null, open: true });
		expect((await assessmentsOf(fx)).length).toBe(2);
	});

	it('keeps explicit false, explicit clearing and a restated value as the feature write; unset is absent', async () => {
		const a = await intentionOf(fx, 'A');
		await fx.repository.createDirectAssessment(a.id, { outcome: 'completed', open: true });
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Ещё раз';
		draft.results.add(a.id);
		expect(draft.results.rowOf(a.id)?.state).toEqual({ outcome: 'completed', open: true });
		draft.results.setOpen(a.id, false);
		const closed = draft.values.targets[0].input;
		expect(Object.hasOwn(closed, 'outcome')).toBe(false);
		expect(JSON.parse(JSON.stringify(closed))).toEqual({ open: false });
		draft.results.setOpen(a.id, undefined);
		expect(Object.keys(draft.values.targets[0].input)).toEqual([]);
		draft.results.setOutcome(a.id, null);
		expect(Object.hasOwn(draft.values.targets[0].input, 'outcome')).toBe(true);
		expect(JSON.parse(JSON.stringify(draft.values.targets[0].input))).toEqual({ outcome: null });
		// The same outcome the intention already shows is stated again, not dropped as unchanged.
		draft.results.setOutcome(a.id, 'completed');
		draft.results.setOpen(a.id, true);
		await draft.save(opened);
		const rows = await assessmentsOf(fx);
		expect(rows.filter((row) => row.intentionId === a.id)).toHaveLength(2);
		expect(rows.find((row) => row.source === 'evidence')).toMatchObject({
			outcome: 'completed',
			open: true,
			isDeleted: false
		});
	});

	it('adds a result to a closed intention through «Все»; without a statement it stays closed with its outcome', async () => {
		const done = await intentionOf(fx, 'Закрытое');
		const open = await intentionOf(fx, 'Открытое');
		await fx.repository.createDirectAssessment(done.id, { outcome: 'completed', open: false });
		const draft = await fx.open({ mode: 'create' });
		const filter = {
			role: 'intention',
			selfId: null,
			query: '',
			scopeId: '',
			from: '',
			to: ''
		} as const;
		expect(
			resultCandidates(draft.results.rows, { ...filter, all: false }).map((r) => r.title)
		).toEqual(['Открытое']);
		expect(
			resultCandidates(draft.results.rows, { ...filter, all: true }).map((r) => r.title)
		).toEqual(['Закрытое', 'Открытое']);
		draft.title = 'Поздний факт';
		draft.results.add(done.id);
		await draft.save(opened);
		expect(await evidenceOf(fx, draft.commit!.id)).toEqual([[done.id, false]]);
		expect(await stateOf(fx, done.id)).toMatchObject({ outcome: 'completed', open: false });
		void open;
	});

	it('«Факт → Намерение» drops the chosen results and statements; back to a fact restores nothing', async () => {
		const a = await intentionOf(fx, 'A');
		const draft = await fx.open({ mode: 'create' });
		draft.results.add(a.id);
		draft.results.setOutcome(a.id, 'partial');
		expect(draft.dirty).toBe(true);
		draft.setRelation('intend');
		expect(draft.values.targets).toEqual([]);
		expect(draft.values.placement.aboutTime).toEqual({ basis: 'unknown' });
		draft.setRelation('actual');
		expect(draft.values.targets).toEqual([]);
		expect(draft.values.placement.aboutTime?.basis).toBe('absolute');
	});

	it('an undated fact is linked without a statement; a statement through it needs the event date and keeps the input', async () => {
		const a = await intentionOf(fx, 'A');
		const b = await intentionOf(fx, 'B');
		const first = await fx.open({ mode: 'create' });
		first.title = 'Без даты';
		first.time = { mode: 'chosen', chosen: undatedPlacement() };
		first.results.add(a.id);
		expect(first.canSave).toBe(true);
		await first.save(opened);
		expect(await evidenceOf(fx, first.commit!.id)).toEqual([[a.id, false]]);
		expect(await assessmentsOf(fx)).toEqual([]);
		const second = await fx.open({ mode: 'create' });
		second.title = 'Тоже без даты';
		second.time = { mode: 'chosen', chosen: undatedPlacement() };
		second.results.add(b.id);
		second.results.setOutcome(b.id, 'partial');
		expect(second.issues.map((issue) => issue.key)).toEqual(['draft.assessmentNeedsDate']);
		expect(second.canSave).toBe(false);
		second.setRelation('intend');
		second.setRelation('actual');
		// The date is back, the statement went with the switch: nothing hidden returned.
		expect(second.values.targets).toEqual([]);
		second.results.add(b.id);
		second.results.setOutcome(b.id, 'partial');
		expect(second.canSave).toBe(true);
		await second.save(opened);
		expect(await stateOf(fx, b.id)).toMatchObject({ outcome: 'partial', open: true });
	});

	it('a typed fact carries the same results and statements as a plain one', async () => {
		const a = await intentionOf(fx, 'A');
		const { kind, version } = await fx.kind('Вес', numberKind('Вес', 'weight'));
		const draft = await fx.open({ mode: 'create', kindId: kind.id, versionId: version.id });
		draft.results.add(a.id);
		draft.results.setOutcome(a.id, 'not_completed');
		draft.results.setOpen(a.id, false);
		expect(draft.typed).toBe(true);
		expect(draft.canSave).toBe(true);
		await draft.save(opened);
		expect(await evidenceOf(fx, draft.commit!.id)).toEqual([[a.id, false]]);
		expect(await stateOf(fx, a.id)).toMatchObject({ outcome: 'not_completed', open: false });
	});

	it('a refused save keeps the input editable with the reason and writes nothing', async () => {
		const a = await intentionOf(fx, 'A');
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Опоздавший факт';
		draft.results.add(a.id);
		draft.results.setOutcome(a.id, 'completed');
		await fx.repository.setTraceDeleted(a.id, true);
		const before = (await fx.repository.listTraces(true)).length;
		await draft.save(opened);
		expect(draft.phase).toBe('editing');
		expect(draft.failure?.code).toBe('evidence_endpoint');
		expect(draft.values.targets).toEqual([
			{ otherId: a.id, linkId: null, input: { outcome: 'completed' } }
		]);
		expect(draft.title).toBe('Опоздавший факт');
		expect((await fx.repository.listTraces(true)).length).toBe(before);
		expect(await assessmentsOf(fx)).toEqual([]);
	});
});
