import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { createImportedDataSpace, DATA_SPACES } from '../data-space';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { plainDraft, plainFields } from '../Traces/record.fixture';
import { createBackupRepository } from './Backup';

const clients: TriplitClient<typeof schema>[] = [];
const replica = () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return { client, repository: createTriplitRepository(client) };
};
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('round-trips field revisions and withdrawn first creations and keeps the inverse honest after restore', async () => {
	const source = replica();
	const intention = await source.repository.createTrace(plainDraft('Взвеситься', 'intend'));
	const fact = await source.repository.saveTraceRecord({
		fields: plainFields('80 кг'),
		links: { add: [{ kind: 'evidence_for', intentionId: intention.id }] }
	});
	const edit = await source.repository.saveTraceRecord({
		id: fact.trace.id,
		fields: { title: '81 кг' }
	});
	const created = await source.repository.createEvidenceAssessment(fact.links[0].id, {
		open: true
	});
	// A correction taken back leaves an inert slot; a genuine correction names its own statement.
	const { assessment: corrected } = await source.repository.editIntentionAssessment(created.id, {
		open: false
	});
	const correctionUndone = await source.repository.undoOperation(corrected.openRevision!);
	const { assessment: genuine } = await source.repository.editIntentionAssessment(created.id, {
		outcome: 'partial'
	});
	await source.repository.undoOperation(genuine.outcomeRevision!);
	const undone = await source.repository.undoOperation(created.openRevision!);
	const file = JSON.parse(
		JSON.stringify(await createBackupRepository(source.client, DATA_SPACES.canonical).export())
	);
	const traceRow = file.collections.traces.find((row: { id: string }) => row.id === fact.trace.id);
	expect(traceRow.revisions).toEqual({ content: edit.operation.id });
	const sourceRow = file.collections.intentionAssessments.find(
		(row: { id: string }) => row.id === created.id
	);
	expect(sourceRow.initial[created.openRevision!]).toMatchObject({
		withdrawn: undone.operation.id
	});
	expect(sourceRow.values.open).toEqual({
		value: true,
		operationId: correctionUndone.operation.id,
		statement: null
	});
	expect(sourceRow.values.outcome).toMatchObject({ statement: null });

	const destination = replica();
	await createBackupRepository(destination.client, createImportedDataSpace('Копия')).restore(file);
	expect(await destination.client.fetchById('traces', fact.trace.id)).toEqual(
		await source.client.fetchById('traces', fact.trace.id)
	);
	expect(await destination.client.fetchById('intentionAssessments', created.id)).toEqual(
		await source.client.fetchById('intentionAssessments', created.id)
	);
	expect(await destination.repository.listIntentionAssessments()).toEqual([]);
	// The restored journal and stamps carry the same causality: the edit is still invertible,
	// the withdrawn creation is not offered back.
	await expect(destination.repository.undoOperation(created.openRevision!)).rejects.toMatchObject({
		code: 'undo_stale',
		details: { reason: 'candidate' }
	});
	await destination.repository.undoOperation(edit.operation.id);
	expect(
		(await destination.repository.listTraces()).find((row) => row.id === fact.trace.id)?.content
	).toBe('80 кг');
});
