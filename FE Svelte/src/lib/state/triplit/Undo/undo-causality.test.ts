import { afterEach, describe, expect, it } from 'vitest';
import { asRepositoryClient, type TempienceRepository } from '../repository';
import { editTraceInTransaction } from '../Traces/edit';
import { traceRevisions } from '../Traces/revisions';
import {
	journalOf,
	openRecordFixture,
	outcome,
	plainDraft,
	snapshotOf,
	type RecordFixture
} from './undo.fixture';

let fixture: RecordFixture;
let repo: TempienceRepository;
afterEach(async () => {
	await fixture?.dispose();
});
const open = () => {
	fixture = openRecordFixture();
	repo = fixture.repository;
};

/** A physical write with an explicit operation clock, as devices with their own clocks produce. */
const write = (traceId: string, id: string, timestamp: string, patch: Record<string, unknown>) =>
	asRepositoryClient(fixture.client).transact((transaction) =>
		editTraceInTransaction(transaction, traceId, patch, 'user', { id, timestamp })
	);

describe('undoOperation — causal field revisions', () => {
	it('refuses a later same-field A→B→A whatever the operation clocks say, and keeps later independent fields', async () => {
		open();
		const trace = await repo.createTrace(plainDraft('initial'));
		await write(trace.id, 'offered-fast-clock', '2026-09-13T12:00:00.000Z', { content: 'offered' });
		await write(trace.id, 'later-slow-clock-1', '2026-09-13T11:00:00.000Z', {
			content: 'independent'
		});
		await write(trace.id, 'later-slow-clock-2', '2026-09-13T11:01:00.000Z', { content: 'offered' });
		expect(traceRevisions((await fixture.client.fetchById('traces', trace.id))!)).toEqual({
			content: 'later-slow-clock-2'
		});
		const before = await snapshotOf(repo);
		await expect(repo.undoOperation('offered-fast-clock')).rejects.toMatchObject({
			code: 'undo_stale',
			details: {
				step: 'trace.fields',
				reason: 'revision',
				field: 'content',
				revision: 'later-slow-clock-2'
			}
		});
		expect(await snapshotOf(repo)).toEqual(before);
		expect((await repo.listTraces()).find((row) => row.id === trace.id)?.content).toBe('offered');

		// A later write of another field with an earlier clock is independent of the offered one.
		await write(trace.id, 'later-slow-clock-3', '2026-09-13T10:00:00.000Z', {
			description: 'note'
		});
		const undone = await repo.undoOperation('later-slow-clock-2');
		expect(await journalOf(repo, undone.operation.id)).toEqual(['trace:updated:undo']);
		expect((await repo.listTraces()).find((row) => row.id === trace.id)).toMatchObject({
			content: 'independent',
			description: 'note'
		});
		expect(traceRevisions((await fixture.client.fetchById('traces', trace.id))!)).toEqual({
			content: undone.operation.id,
			description: 'later-slow-clock-3'
		});
		expect(await outcome(repo.undoOperation('later-slow-clock-2'))).toBe('undo_stale');
	});

	it('stamps the lifecycle too and refuses an operation whose writer left no stamps', async () => {
		open();
		const trace = await repo.createTrace(plainDraft('Запись'));
		await repo.setTraceDeleted(trace.id, true);
		const deletion = (await repo.listLogs(trace.id))[0].operationId;
		expect(traceRevisions((await fixture.client.fetchById('traces', trace.id))!)).toEqual({
			isDeleted: deletion
		});
		// A previous build wrote the row and its journal without revisions: nothing to verify against.
		const old = 'trace:old-build';
		await fixture.client.insert('traces', {
			id: old,
			capturedAt: '2026-09-12T12:00:00.000Z',
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime: { basis: 'unknown' },
			content: 'B',
			relation: 'actual',
			isDeleted: false,
			createdAt: '2026-09-12T12:00:00.000Z',
			updatedAt: '2026-09-12T12:05:00.000Z'
		} as never);
		await fixture.client.insert('logs', {
			id: 'log:old-build',
			operationId: 'op:old-build',
			entityType: 'trace',
			entityId: old,
			action: 'updated',
			patchJson: JSON.stringify({ content: { before: 'A', after: 'B' } }),
			occurredAt: '2026-09-12T12:05:00.000Z',
			deviceId: 'device:old',
			actor: 'user',
			cause: 'normal'
		} as never);
		const before = await snapshotOf(repo);
		await expect(repo.undoOperation('op:old-build')).rejects.toMatchObject({
			code: 'undo_stale',
			details: { reason: 'revision', field: 'content', revision: null }
		});
		expect(await snapshotOf(repo)).toEqual(before);
	});
});
