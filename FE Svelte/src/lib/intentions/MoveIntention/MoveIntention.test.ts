import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import {
	openRecordFixture,
	plainFields,
	snapshotOf,
	type RecordFixture
} from '$lib/state/triplit/Traces/record.fixture';
import { moveIntention, planMove } from './MoveIntention';

const zone = 'Europe/Belgrade';
const monday = Date.parse('2026-09-13T22:00:00Z');
const trace: ExplorerTrace = {
	id: 'one',
	content: 'one',
	relation: 'intend',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'minute',
		certainty: 'exact',
		start: '2026-09-16T07:15:00Z',
		end: null
	},
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin: { kind: 'canonical', sourceId: 'test' }
};
let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});

describe('planMove', () => {
	it('preserves the local time on a different day and its new UTC offset', () => {
		expect(planMove(trace, { kind: 'day', dayKey: '2026-12-01' }, zone)).toEqual({
			ok: true,
			fields: {
				aboutKind: 'instant',
				statedDuration: null,
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: '2026-12-01T09:15:00+01:00',
					end: null
				}
			}
		});
	});
	it('refuses a nonexistent local time at the spring clock change', () => {
		const early = {
			...trace,
			aboutTime: {
				basis: 'absolute',
				precision: 'minute',
				certainty: 'exact',
				start: '2026-03-20T01:30:00Z',
				end: null
			} as const
		};
		expect(planMove(early, { kind: 'day', dayKey: '2026-03-29' }, zone)).toEqual({
			ok: false,
			reason: 'invalid_target'
		});
	});
	it('writes a day, a Monday–Sunday interval, or unknown; preserves independent duration where possible', () => {
		const coarse = { ...trace, aboutTime: { basis: 'unknown' } as const };
		expect(planMove(coarse, { kind: 'day', dayKey: '2026-09-10' }, zone)).toMatchObject({
			ok: true,
			fields: {
				aboutKind: 'instant',
				aboutTime: { precision: 'day', start: '2026-09-10', end: null }
			}
		});
		expect(planMove(trace, { kind: 'week', weekStart: monday }, zone)).toEqual({
			ok: true,
			fields: {
				aboutKind: 'interval',
				statedDuration: null,
				aboutTime: {
					basis: 'absolute',
					precision: 'day',
					certainty: 'exact',
					start: '2026-09-14',
					end: '2026-09-20'
				}
			}
		});
		const duration = {
			...coarse,
			aboutKind: 'interval' as const,
			statedDuration: { amount: 2, unit: 'day' as const }
		};
		expect(planMove(duration, { kind: 'undated' }, zone)).toEqual({
			ok: true,
			fields: {
				aboutKind: 'interval',
				statedDuration: duration.statedDuration,
				aboutTime: { basis: 'unknown' }
			}
		});
		expect(planMove(duration, { kind: 'day', dayKey: '2026-09-10' }, zone)).toMatchObject({
			ok: true,
			fields: { aboutKind: 'interval', statedDuration: duration.statedDuration }
		});
	});
	it('refuses closed intentions, facts, and invalid targets', () => {
		expect(planMove({ ...trace, intentOpen: false }, { kind: 'undated' }, zone)).toEqual({
			ok: false,
			reason: 'closed'
		});
		expect(planMove({ ...trace, relation: 'actual' }, { kind: 'undated' }, zone)).toEqual({
			ok: false,
			reason: 'not_intention'
		});
		expect(planMove(trace, { kind: 'day', dayKey: '2026-02-30' }, zone)).toEqual({
			ok: false,
			reason: 'invalid_target'
		});
		expect(planMove(trace, { kind: 'week', weekStart: monday + 1 }, zone)).toEqual({
			ok: false,
			reason: 'invalid_target'
		});
	});
});

describe('moveIntention with the repository', () => {
	it('saves each move once, including past, unknown, and a week, then refuses a closed record', async () => {
		fixture = openRecordFixture();
		const { repository } = fixture;
		const original = await repository.saveTraceRecord({
			fields: plainFields('test', { relation: 'intend' })
		});
		const id = original.trace.id;
		const save = vi.spyOn(repository, 'saveTraceRecord');
		expect(
			(await moveIntention(repository, id, { kind: 'day', dayKey: '2001-01-01' }, zone)).ok
		).toBe(true);
		expect((await repository.getTrace(id))?.aboutTime).toMatchObject({
			precision: 'day',
			start: '2001-01-01'
		});
		expect((await moveIntention(repository, id, { kind: 'undated' }, zone)).ok).toBe(true);
		expect((await repository.getTrace(id))?.aboutTime).toEqual({ basis: 'unknown' });
		expect(
			(await moveIntention(repository, id, { kind: 'week', weekStart: monday }, zone)).ok
		).toBe(true);
		expect(await repository.getTrace(id)).toMatchObject({
			aboutKind: 'interval',
			aboutTime: { start: '2026-09-14', end: '2026-09-20' }
		});
		expect(save).toHaveBeenCalledTimes(3);
		await repository.createDirectAssessment(id, { open: false });
		const before = await snapshotOf(repository);
		expect(await moveIntention(repository, id, { kind: 'undated' }, zone)).toEqual({
			ok: false,
			reason: 'closed'
		});
		expect(await snapshotOf(repository)).toEqual(before);
		expect(save).toHaveBeenCalledTimes(3);
	});
	it('returns the operation ID and standard undo restores the placement', async () => {
		fixture = openRecordFixture();
		const { repository } = fixture;
		const created = await repository.saveTraceRecord({
			fields: plainFields('undo move', { relation: 'intend' })
		});
		const before = await repository.getTrace(created.trace.id);
		const result = await moveIntention(repository, created.trace.id, { kind: 'undated' }, zone);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.reason);
		expect(result.operationId).toBeTruthy();
		expect((await repository.getTrace(created.trace.id))?.aboutTime).toEqual({ basis: 'unknown' });
		await repository.undoOperation(result.operationId, 'user');
		const restored = await repository.getTrace(created.trace.id);
		expect(restored?.aboutTime).toEqual(before?.aboutTime);
		expect(restored?.aboutKind).toEqual(before?.aboutKind);
		expect(restored?.statedDuration).toEqual(before?.statedDuration);
	});
});
