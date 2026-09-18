import { TriplitClient } from '@triplit/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createAssessmentFixture, type AssessmentFixture } from '../IntentionAssessments/fixture';
import { assessmentIdFor } from '../IntentionAssessments/read';
import { createImportedDataSpace } from '../data-space';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { createBackupRepository } from './Backup';
import { BACKUP_COLLECTIONS, BACKUP_COLLECTION_PROFILES } from './constants';
import { parseDataSpaceBackup } from './parse';
import type { DataSpaceBackup } from './types';

const fixtures: AssessmentFixture[] = [];
const clients: TriplitClient<typeof schema>[] = [];
afterEach(async () => {
	for (const fixture of fixtures.splice(0)) await fixture.dispose();
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const emptyTarget = () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return { client, backup: createBackupRepository(client, createImportedDataSpace('Копия')) };
};

/** A file with evidence, direct, withdrawn and detached (unlinked) sources plus their journal. */
const exportWithSources = async () => {
	const fixture = await createAssessmentFixture();
	fixtures.push(fixture);
	const { repository, link, intention, fact } = fixture;
	const evidence = await repository.createEvidenceAssessment(link.id, {
		outcome: 'partial',
		open: false
	});
	await repository.editIntentionAssessment(evidence.id, { outcome: 'completed' });
	const direct = await repository.createDirectAssessment(intention.id, { open: true });
	const withdrawn = await repository.createDirectAssessment(intention.id, {
		outcome: 'alternative'
	});
	await repository.setIntentionAssessmentDeleted(withdrawn.id, true);
	// Unlink and relink: the first source stays bound to the superseded activation.
	await repository.setIntersectionDeleted(link.id, true);
	const fresh = await repository.createIntersection({
		fromId: fact.id,
		toId: intention.id,
		kind: 'evidence_for'
	});
	const renewed = await repository.createEvidenceAssessment(fresh.id, { open: false });
	const file = await createBackupRepository(
		fixture.client,
		createImportedDataSpace('Источник')
	).export();
	return { fixture, file, ids: { evidence, direct, withdrawn, renewed } };
};

describe('backup of intention assessments', () => {
	it('reads an older export that lacks only the new collection as an empty set', async () => {
		const { client, backup } = emptyTarget();
		const file = await backup.export();
		expect(Object.keys(file.collections)).toEqual(BACKUP_COLLECTIONS);
		const older = structuredClone(file) as { collections: Partial<DataSpaceBackup['collections']> };
		delete older.collections.intentionAssessments;
		expect(BACKUP_COLLECTION_PROFILES.at(-1)?.toSorted()).toEqual(
			[...BACKUP_COLLECTIONS].toSorted()
		);
		expect(parseDataSpaceBackup(older).collections.intentionAssessments).toEqual([]);
		await backup.restore(older);
		expect(await createTriplitRepository(client).listIntentionAssessments()).toEqual([]);
	});

	it('still refuses files that lack a legacy collection or carry an unknown one', async () => {
		const { backup } = emptyTarget();
		const file = await backup.export();
		const missingLegacy = structuredClone(file) as {
			collections: Partial<DataSpaceBackup['collections']>;
		};
		delete missingLegacy.collections.intersections;
		expect(() => parseDataSpaceBackup(missingLegacy)).toThrow('Набор коллекций');
		const unknown = structuredClone(file) as { collections: Record<string, unknown> };
		unknown.collections.assessments = [];
		expect(() => parseDataSpaceBackup(unknown)).toThrow('Набор коллекций');
	});

	it('round-trips withdrawn and detached sources with their journal for history and undo', async () => {
		const { fixture, file, ids } = await exportWithSources();
		expect(file.collections.intentionAssessments).toHaveLength(4);
		const { client, backup } = emptyTarget();
		await backup.restore(file);
		const restored = createTriplitRepository(client);
		const rows = await restored.listIntentionAssessments(true);
		expect(rows).toEqual(await fixture.repository.listIntentionAssessments(true));
		expect(rows.find((row) => row.id === ids.evidence.id)).toMatchObject({
			outcome: 'completed',
			open: false,
			firstAssessedAt: ids.evidence.firstAssessedAt
		});
		expect(rows.find((row) => row.id === ids.withdrawn.id)?.isDeleted).toBe(true);
		expect(rows.find((row) => row.id === ids.renewed.id)?.activationId).not.toBe(
			ids.evidence.activationId
		);
		expect((await restored.listLogs()).length).toBe(file.collections.logs.length);
		expect(await backup.export()).toMatchObject({ collections: file.collections });
	});

	it('rejects broken references, sources and values before writing anything', async () => {
		const { file, ids } = await exportWithSources();
		const { client, backup } = emptyTarget();
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
		const row = (copy: DataSpaceBackup, id: string) =>
			copy.collections.intentionAssessments.find((entry) => entry.id === id) as Record<
				string,
				unknown
			>;
		expect(
			await attempt((copy) => {
				(row(copy, ids.direct.id).origin as { intentionId: string }).intentionId = 'missing';
			})
		).toMatch('отсутствующее намерение');
		expect(
			await attempt((copy) => {
				(row(copy, ids.evidence.id).origin as { factId: string }).factId = 'missing';
			})
		).toMatch('отсутствующий факт');
		expect(
			await attempt((copy) => {
				(row(copy, ids.evidence.id).origin as { evidenceId: string }).evidenceId = 'other';
			})
		).toMatch('несуществующую связь');
		expect(
			await attempt((copy) => {
				row(copy, ids.direct.id).placement = {
					intentionId: ids.direct.intentionId,
					evidenceId: 'x',
					activationId: 'y'
				};
			})
		).toMatch('Некорректная запись оценки');
		expect(
			await attempt((copy) => {
				row(copy, ids.direct.id).source = 'guess';
			})
		).toMatch('Некорректная запись оценки');
		expect(
			await attempt((copy) => {
				(row(copy, ids.evidence.id).values as { outcome: { value: string } }).outcome.value =
					'done';
			})
		).toMatch('Некорректная запись оценки');
		expect(
			await attempt((copy) => {
				row(copy, ids.evidence.id).placement = {
					intentionId: ids.evidence.intentionId,
					evidenceId: 'missing-link',
					activationId: 'later'
				};
			})
		).toMatch('Перенесённая оценка');
		expect(
			await attempt((copy) => {
				row(copy, ids.evidence.id).unknownField = 1;
			})
		).toMatch('неизвестные');
		expect(
			await attempt((copy) => {
				copy.collections.intentionAssessments.push({
					id: assessmentIdFor('unknown-activation'),
					source: 'evidence',
					origin: {
						factId: ids.evidence.factId,
						intentionId: ids.evidence.intentionId,
						evidenceId: ids.evidence.evidenceId,
						activationId: 'unknown-activation'
					},
					initial: { 'op-x': { at: '2026-09-11T10:00:00.000Z', open: true } },
					updatedAt: '2026-09-11T10:00:00.000Z'
				});
			})
		).toBe('accepted');
		// The accepted detached source above was the only write: nothing else reached the replica.
		expect(await createTriplitRepository(client).listIntentionAssessments(true)).toHaveLength(5);
	});
});
