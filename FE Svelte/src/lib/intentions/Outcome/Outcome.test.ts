import { afterEach, describe, expect, it } from 'vitest';
import { buildRepositoryExplorerSnapshot } from '$lib/state/Workbench/snapshot';
import {
	dayTime,
	openRecordFixture,
	plainFields,
	type RecordFixture
} from '$lib/state/triplit/Traces/record.fixture';
import { completeIntention } from '../CompleteIntention/CompleteIntention';
import { recordResult, setOpen, setOutcome } from './Outcome';

const now = Date.parse('2026-09-13T08:47:32.123Z');
const options = { now, zone: 'Europe/Belgrade' };
let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});

const open = async () => {
	fixture = openRecordFixture();
	const repo = fixture.repository;
	const scope = await repo.createScope({ name: 'Дом' });
	const intention = await repo.saveTraceRecord({
		fields: plainFields('Получить права', { relation: 'intend', aboutTime: dayTime('2026-09-20') }),
		memberships: { add: [scope.id] }
	});
	return { repo, scope, id: intention.trace.id };
};

const stateOf = async (repo: RecordFixture['repository'], id: string) => {
	const snapshot = await buildRepositoryExplorerSnapshot(repo, 'intentions');
	const trace = snapshot.traces.find((item) => item.id === id)!;
	return { outcome: trace.intentOutcome ?? null, open: trace.intentOpen !== false };
};

describe('recordResult', () => {
	it('«partial» records a fact in the task scopes and leaves the task open', async () => {
		const { repo, scope, id } = await open();
		const result = await recordResult(repo, id, '  Собрал копии  ', 'partial', options);
		expect(result.ok).toBe(true);
		if (!result.ok || !result.factId) throw new Error('not recorded');
		expect(await repo.getTrace(result.factId)).toMatchObject({
			content: 'Собрал копии',
			relation: 'actual',
			capturedAt: '2026-09-13T08:47:32.123Z'
		});
		const links = (await repo.listIntersections()).filter((link) => link.fromId === result.factId);
		expect(links.map(({ kind, toId }) => [kind, toId]).toSorted()).toEqual(
			[
				['belongs_to', scope.id],
				['evidence_for', id]
			].toSorted()
		);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: true });
	});

	it('«alternative» records a fact and closes the task', async () => {
		const { repo, id } = await open();
		const result = await recordResult(repo, id, 'Заселил сожителя', 'alternative', options);
		expect(result.ok).toBe(true);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'alternative', open: false });
	});

	it('refuses an empty text, an unknown task and a later statement without writing', async () => {
		const { repo, id } = await open();
		const logs = (await repo.listLogs()).length;
		expect(await recordResult(repo, id, '   ', 'partial', options)).toEqual({
			ok: false,
			reason: 'text_required'
		});
		expect(await recordResult(repo, 'missing', 'x', 'partial', options)).toEqual({
			ok: false,
			reason: 'not_found'
		});
		expect((await repo.listLogs()).length).toBe(logs);
		await completeIntention(repo, id, { ...options, now: now + 86_400_000 });
		expect(await recordResult(repo, id, 'x', 'partial', options)).toEqual({
			ok: false,
			reason: 'later_result_exists'
		});
	});
});

describe('setOutcome', () => {
	it('presets close the task: «not_completed» with that outcome, «none» without any', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		const cancelled = await setOutcome(repo, id, 'none', { close: true });
		expect(cancelled.ok).toBe(true);
		expect(await stateOf(repo, id)).toEqual({ outcome: null, open: false });
		await setOutcome(repo, id, 'not_completed', { close: true });
		expect(await stateOf(repo, id)).toEqual({ outcome: 'not_completed', open: false });
	});

	it('without `close` only the outcome changes, and an Undo takes it back', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		const result = await setOutcome(repo, id, 'none');
		if (!result.ok) throw new Error(result.reason);
		expect(await stateOf(repo, id)).toEqual({ outcome: null, open: true });
		await repo.undoOperation(result.operationId);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: true });
	});
});

describe('setOpen', () => {
	it('closes and opens without touching a standing outcome', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		await setOpen(repo, id, false, options);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: false });
		await setOpen(repo, id, true, options);
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: true });
		expect(await setOpen(repo, id, true, options)).toEqual({ ok: false, reason: 'unchanged' });
	});

	it('opening a completed task gives the outcome back and keeps the completion fact', async () => {
		const { repo, id } = await open();
		const completed = await completeIntention(repo, id, options);
		if (!completed.ok) throw new Error(completed.reason);
		await setOpen(repo, id, true, { now: now + 1000 });
		expect(await stateOf(repo, id)).toEqual({ outcome: null, open: true });
		expect((await repo.getTrace(completed.factId))?.isDeleted).toBe(false);
	});

	it('restores the outcome that stood before the completion', async () => {
		const { repo, id } = await open();
		await recordResult(repo, id, 'Часть', 'partial', options);
		await completeIntention(repo, id, { ...options, now: now + 1000 });
		expect(await stateOf(repo, id)).toEqual({ outcome: 'completed', open: false });
		await setOpen(repo, id, true, { now: now + 2000 });
		expect(await stateOf(repo, id)).toEqual({ outcome: 'partial', open: true });
	});
});
