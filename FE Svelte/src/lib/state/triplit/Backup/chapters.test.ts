import { TriplitClient } from '@triplit/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createImportedDataSpace } from '../data-space';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { createBackupRepository } from './Backup';
import { parseDataSpaceBackup } from './parse';
import type { DataSpaceBackup } from './types';

const clients: TriplitClient<typeof schema>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const space = () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return {
		client,
		repository: createTriplitRepository(client),
		backup: createBackupRepository(client, createImportedDataSpace('Копия'))
	};
};

const iso = (day: string) => `2026-${day}T00:00:00+02:00`;

/** A space with a closed chapter, an open one, stages of both kinds, a deleted chapter and a deleted Scope. */
const exportWithChapters = async () => {
	const { repository, backup } = space();
	const [tempience, body, boxing] = await Promise.all(
		['Tempience', 'Зажимы', 'Бокс'].map((name) => repository.createScope({ name }))
	);
	const system = await repository.createChapter({
		name: 'Собрать систему',
		note: 'Довожу Tempience до руки',
		colorHue: 80,
		colorChroma: 90,
		colorDepth: 2,
		start: iso('09-01'),
		closedAt: iso('09-25'),
		lineup: [
			{ scopeId: tempience.id, level: 'focus' },
			{ scopeId: body.id, level: 'support' }
		]
	});
	await repository.createChapterStage(system.id, {
		name: 'Открытие',
		note: 'Сначала тело',
		start: iso('09-01'),
		lineup: [{ scopeId: body.id, level: 'focus' }]
	});
	await repository.createChapterStage(system.id, { name: 'Рывок', start: iso('09-08') });
	await repository.createChapter({
		name: 'Выход наружу',
		start: iso('09-28'),
		lineup: [
			{ scopeId: tempience.id, level: 'focus' },
			{ scopeId: boxing.id, level: 'focus' }
		]
	});
	const gone = await repository.createChapter({ name: 'Черновик', start: iso('10-10') });
	await repository.createChapterStage(gone.id, { name: 'Этап', start: iso('10-11') });
	await repository.setChapterDeleted(gone.id, true);
	await repository.setScopeDeleted(boxing.id, true);
	return { chapters: await repository.listChapters(), file: await backup.export(), gone };
};

describe('backup of chapters', () => {
	it('round-trips chapters, their stages, deletions and journal: the same chapters come back', async () => {
		const { chapters, file, gone } = await exportWithChapters();
		expect(file.collections.chapters).toHaveLength(3);
		expect(file.collections.chapterStages).toHaveLength(3);
		const target = space();
		await target.backup.restore(JSON.parse(JSON.stringify(file)));
		expect(await target.repository.listChapters()).toEqual(chapters);
		// The deleted Scope's entry came along in storage and returns with the Scope.
		const boxing = (await target.repository.listScopes(true)).find((s) => s.name === 'Бокс')!;
		await target.repository.setScopeDeleted(boxing.id, false);
		expect((await target.repository.listChapters()).at(-1)?.lineup).toHaveLength(2);
		// The deleted chapter returns with the stage that went with it.
		const restored = await target.repository.setChapterDeleted(gone.id, false);
		expect(restored.chapter.stages.map((stage) => stage.name)).toEqual(['Этап']);
		expect((await target.repository.listLogs(gone.id)).map((log) => log.action)).toEqual([
			'restored',
			'deleted',
			'created'
		]);
	});

	it('restores an export from before chapters with none', async () => {
		const { file } = await exportWithChapters();
		const older = structuredClone(file) as { collections: Partial<DataSpaceBackup['collections']> };
		delete older.collections.chapters;
		delete older.collections.chapterStages;
		const parsed = parseDataSpaceBackup(older);
		expect(parsed.collections.chapters).toEqual([]);
		expect(parsed.collections.chapterStages).toEqual([]);
		const target = space();
		await target.backup.restore(older);
		expect(await target.repository.listChapters()).toEqual([]);
		expect(await target.repository.listScopes()).toHaveLength(2);
	});

	it('refuses a stage whose chapter is not in the file, or a file with only one of the two', async () => {
		const { file } = await exportWithChapters();
		const orphan = structuredClone(file);
		orphan.collections.chapters = orphan.collections.chapters.filter(
			(row) => row.id !== orphan.collections.chapterStages[0].chapterId
		);
		expect(() => parseDataSpaceBackup(orphan)).toThrow('отсутствующую главу');
		const half = structuredClone(file) as { collections: Partial<DataSpaceBackup['collections']> };
		delete half.collections.chapterStages;
		expect(() => parseDataSpaceBackup(half)).toThrow('Набор коллекций');
	});
});
