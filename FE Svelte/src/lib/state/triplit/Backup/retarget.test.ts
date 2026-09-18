import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { createImportedDataSpace } from '../data-space';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import type { TraceDraft } from '../types';
import { createBackupRepository } from './Backup';
import type { DataSpaceBackup } from './types';

const clients: TriplitClient<typeof schema>[] = [];
const createClient = () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return client;
};
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const draft = (content: string, relation: 'intend' | 'actual'): TraceDraft => ({
	content,
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	},
	relation
});

/** Transferred, withdrawn and detached sources with a bound link, as a retarget leaves them. */
const exportRetargeted = async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const a = await repository.createTrace(draft('A', 'intend'));
	const b = await repository.createTrace(draft('B', 'intend'));
	const f = await repository.createTrace(draft('F', 'actual'));
	const fbOld = await repository.createIntersection({
		fromId: f.id,
		toId: b.id,
		kind: 'evidence_for'
	});
	const detached = await repository.createEvidenceAssessment(fbOld.id, { outcome: 'alternative' });
	await repository.setIntersectionDeleted(fbOld.id, true);
	const fa = await repository.createIntersection({
		fromId: f.id,
		toId: a.id,
		kind: 'evidence_for'
	});
	await repository.createEvidenceAssessment(fa.id, { outcome: 'completed', open: false });
	const withdrawn = await repository.createDirectAssessment(a.id, { open: true });
	await repository.setIntentionAssessmentDeleted(withdrawn.id, true);
	const { link, assessment } = await repository.correctEvidenceTarget(fa.id, b.id);
	const file = await createBackupRepository(client, createImportedDataSpace('Источник')).export();
	return { repository, file, ids: { link, transferred: assessment!, detached, withdrawn, fa } };
};

it('round-trips a transfer binding, placement revision, withdrawn and detached sources with identities', async () => {
	const { repository, file, ids } = await exportRetargeted();
	const storedLink = file.collections.intersections.find((row) => row.id === ids.link.id) as Record<
		string,
		unknown
	>;
	expect(storedLink.assessmentId).toBe(ids.transferred.id);
	const storedSource = file.collections.intentionAssessments.find(
		(row) => row.id === ids.transferred.id
	) as Record<string, unknown>;
	expect((storedSource.placement as Record<string, unknown>).operationId).toBe(
		ids.transferred.placementRevision
	);

	const target = createClient();
	const backup = createBackupRepository(target, createImportedDataSpace('Копия'));
	await backup.restore(file);
	const restored = createTriplitRepository(target);
	expect(await restored.listIntersections(true)).toEqual(await repository.listIntersections(true));
	expect(await restored.listIntentionAssessments(true)).toEqual(
		await repository.listIntentionAssessments(true)
	);
	expect(await restored.listLogs()).toEqual(await repository.listLogs());
	expect((await restored.listIntentionAssessments(true)).map((row) => row.id).toSorted()).toEqual(
		[ids.transferred.id, ids.detached.id, ids.withdrawn.id].toSorted()
	);
	expect((await backup.export()).collections).toEqual(file.collections);
});

it('refuses a binding to a missing source or on a non-evidence link before writing, but keeps detached history', async () => {
	const { file, ids } = await exportRetargeted();
	const target = createClient();
	const backup = createBackupRepository(target, createImportedDataSpace('Копия'));
	const attempt = async (mutate: (copy: DataSpaceBackup) => void): Promise<string> => {
		const copy = structuredClone(file);
		mutate(copy);
		try {
			await backup.restore(copy);
			return 'accepted';
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	};
	const link = (copy: DataSpaceBackup) =>
		copy.collections.intersections.find((row) => row.id === ids.link.id) as Record<string, unknown>;
	const source = (copy: DataSpaceBackup) =>
		copy.collections.intentionAssessments.find((row) => row.id === ids.transferred.id) as Record<
			string,
			unknown
		>;
	expect(await attempt((copy) => void (link(copy).assessmentId = 'assessment:missing'))).toMatch(
		'перенесённую оценку'
	);
	expect(
		await attempt((copy) => {
			const withdrawnOld = copy.collections.intersections.find(
				(row) => row.id === ids.fa.id
			) as Record<string, unknown>;
			withdrawnOld.kind = 'part_of';
			withdrawnOld.assessmentId = ids.transferred.id;
		})
	).toMatch('перенесённую оценку');
	expect(
		await attempt(
			(copy) => void ((source(copy).placement as Record<string, unknown>).operationId = ' ')
		)
	).toMatch('операция переноса');
	expect(
		await attempt(
			(copy) => void ((source(copy).origin as Record<string, unknown>).operationId = 'op')
		)
	).toMatch('неизвестное поле');
	// A binding whose source no longer matches the link's activation is history, not corruption.
	expect(await attempt((copy) => void (link(copy).activationId = 'another-activation'))).toBe(
		'accepted'
	);
	const restored = createTriplitRepository(target);
	expect(await restored.listIntentionAssessments(true)).toHaveLength(3);
});

it('refuses bindings that no retarget could produce and keeps multi-move history', async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const a = await repository.createTrace(draft('A', 'intend'));
	const b = await repository.createTrace(draft('B', 'intend'));
	const c = await repository.createTrace(draft('C', 'intend'));
	const f = await repository.createTrace(draft('F', 'actual'));
	const g = await repository.createTrace(draft('G', 'actual'));
	const fa = await repository.createIntersection({
		fromId: f.id,
		toId: a.id,
		kind: 'evidence_for'
	});
	const ga = await repository.createIntersection({
		fromId: g.id,
		toId: a.id,
		kind: 'evidence_for'
	});
	const direct = await repository.createDirectAssessment(a.id, { open: false });
	const foreign = await repository.createEvidenceAssessment(ga.id, { outcome: 'completed' });
	const source = await repository.createEvidenceAssessment(fa.id, { outcome: 'partial' });
	const { link: fb } = await repository.correctEvidenceTarget(fa.id, b.id);
	await repository.correctEvidenceTarget(fb.id, c.id);
	await repository.setIntersectionDeleted(fb.id, false);
	const file = await createBackupRepository(client, createImportedDataSpace('Источник')).export();
	const storedB = file.collections.intersections.find((row) => row.id === fb.id) as Record<
		string,
		unknown
	>;
	expect(storedB.assessmentId).toBe(source.id);

	const target = createClient();
	const backup = createBackupRepository(target, createImportedDataSpace('Копия'));
	const attempt = async (mutate: (copy: DataSpaceBackup) => void): Promise<string> => {
		const copy = structuredClone(file);
		mutate(copy);
		try {
			await backup.restore(copy);
			return 'accepted';
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	};
	const link = (copy: DataSpaceBackup) =>
		copy.collections.intersections.find((row) => row.id === fa.id) as Record<string, unknown>;
	expect(await attempt((copy) => void (link(copy).assessmentId = direct.id))).toMatch(
		'перенесённую оценку'
	);
	expect(await attempt((copy) => void (link(copy).assessmentId = foreign.id))).toMatch(
		'перенесённую оценку'
	);
	// The restored old B link bound to a source that moved on is legitimate history.
	expect(await attempt(() => {})).toBe('accepted');
	const restored = createTriplitRepository(target);
	expect(await restored.listIntersections(true)).toEqual(await repository.listIntersections(true));
	expect(await restored.listIntentionAssessments(true)).toEqual(
		await repository.listIntentionAssessments(true)
	);
});
