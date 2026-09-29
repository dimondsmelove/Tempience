import { afterEach, describe, expect, it } from 'vitest';
import type { TempienceRepository } from '../repository';
import { journalOf, openRecordFixture, outcome, type RecordFixture } from './undo.fixture';

let fixture: RecordFixture;
let repo: TempienceRepository;
afterEach(async () => {
	await fixture?.dispose();
});

const scene = async () => {
	fixture = openRecordFixture();
	repo = fixture.repository;
	const { kind, kindV } = await repo.createTraceKind({
		name: 'Замер',
		initialKindV: {
			dataSchema: { type: 'object', properties: { ves: { type: 'number' } } }
		}
	});
	const trace = await repo.createTrace({
		content: 'Утро',
		capturedAt: '2026-09-29T06:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: {
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: '2026-09-29T06:00:00.000Z',
			end: null
		},
		kindId: kind.id,
		kindVId: kindV.id,
		data: { ves: 81.5 }
	});
	return { kind, trace };
};

describe('a Kind deleted softly (owner, 2026-09-29)', () => {
	it('hides the Kind, keeps its records and versions, and is undone like any deletion', async () => {
		const { kind, trace } = await scene();
		const deleted = await repo.setTraceKindDeleted(kind.id, true);
		expect(deleted.kind).toMatchObject({
			isDeleted: true,
			deletionOperationId: deleted.operation?.id
		});
		expect(await journalOf(repo, deleted.operation!.id)).toEqual(['traceKind:deleted:normal']);
		// The record and the version it was written by stay.
		expect((await repo.listTraces()).map((row) => [row.id, row.kindId])).toEqual([
			[trace.id, kind.id]
		]);
		expect(await repo.listTraceKindVersions()).toHaveLength(1);
		// Deleting again writes nothing.
		expect((await repo.setTraceKindDeleted(kind.id, true)).operation).toBeNull();
		const undone = await repo.undoOperation(deleted.operation!.id);
		expect(undone.plan.steps).toEqual([{ kind: 'traceKind.lifecycle', kindId: kind.id }]);
		expect(await journalOf(repo, undone.operation.id)).toEqual(['traceKind:restored:undo']);
		const [back] = await repo.listTraceKinds();
		expect(back).toMatchObject({ id: kind.id, isDeleted: false, deletionOperationId: null });
	});

	it('refuses to undo a deletion another one has replaced', async () => {
		const { kind } = await scene();
		const first = await repo.setTraceKindDeleted(kind.id, true);
		await repo.setTraceKindDeleted(kind.id, false);
		await repo.setTraceKindDeleted(kind.id, true);
		expect(await outcome(repo.undoOperation(first.operation!.id))).toBe('undo_stale');
	});
});
