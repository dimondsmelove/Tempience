import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	openRecordFixture,
	plainFields,
	type RecordFixture
} from '$lib/state/triplit/Traces/record.fixture';
import { moveWhen } from './moveWhen';

const context = {
	zone: 'Europe/Belgrade',
	now: Date.parse('2026-09-16T12:00:00Z'),
	weekStart: Date.parse('2026-09-13T22:00:00Z')
};
let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});

describe('moveWhen', () => {
	it('preserves time, journals once, supports undo and skips identical placement', async () => {
		fixture = openRecordFixture();
		const { repository } = fixture;
		const created = await repository.saveTraceRecord({
			fields: {
				...plainFields('when', { relation: 'intend' }),
				aboutKind: 'instant',
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: '2026-09-16T13:00:00Z',
					end: null
				}
			}
		});
		const before = await repository.getTrace(created.trace.id);
		const save = vi.spyOn(repository, 'saveTraceRecord');
		const same = await moveWhen(
			repository,
			created.trace.id,
			{ kind: 'day', dayKey: '2026-09-16' },
			context
		);
		expect(same.ok && same.operationId).toBeUndefined();
		expect(save).not.toHaveBeenCalled();
		const result = await moveWhen(
			repository,
			created.trace.id,
			{ kind: 'day', dayKey: '2026-09-17' },
			context
		);
		expect(result.ok && result.operationId).toBeTruthy();
		expect((await repository.getTrace(created.trace.id))?.aboutTime).toMatchObject({
			start: '2026-09-17T15:00:00+02:00'
		});
		const unchanged = await moveWhen(
			repository,
			created.trace.id,
			{ kind: 'day', dayKey: '2026-09-17' },
			context
		);
		expect(unchanged.ok && unchanged.operationId).toBeUndefined();
		expect(save).toHaveBeenCalledTimes(1);
		if (!result.ok || !result.operationId) throw new Error('missing operation');
		await repository.undoOperation(result.operationId, 'user');
		expect((await repository.getTrace(created.trace.id))?.aboutTime).toEqual(before?.aboutTime);
	});
	it('refuses missing, non-intention, closed and time without day', async () => {
		fixture = openRecordFixture();
		const { repository } = fixture;
		const intention = await repository.saveTraceRecord({
			fields: { ...plainFields('undated', { relation: 'intend' }), aboutTime: { basis: 'unknown' } }
		});
		const actual = await repository.saveTraceRecord({
			fields: plainFields('actual', { relation: 'actual' })
		});
		expect(await moveWhen(repository, 'missing', { kind: 'today' }, context)).toMatchObject({
			ok: false,
			reason: 'not_found'
		});
		expect(await moveWhen(repository, actual.trace.id, { kind: 'today' }, context)).toMatchObject({
			ok: false,
			reason: 'not_intention'
		});
		expect(
			await moveWhen(
				repository,
				intention.trace.id,
				{ kind: 'time', hours: 15, minutes: 0 },
				context
			)
		).toMatchObject({ ok: false, reason: 'needs_day' });
		await repository.createDirectAssessment(intention.trace.id, { open: false });
		expect(
			await moveWhen(repository, intention.trace.id, { kind: 'today' }, context)
		).toMatchObject({ ok: false, reason: 'closed' });
	});
});
