import { Schema as S, TriplitClient } from '@triplit/client';
import { BTreeKVStore } from '@triplit/db/storage/memory-btree';
import { expect, it } from 'vitest';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';

it('opens a storage from before chapters, keeps its rows and Log, then accepts chapters', async () => {
	const previous = Object.fromEntries(
		Object.entries(schema).filter(([name]) => name !== 'chapters' && name !== 'chapterStages')
	) as Omit<typeof schema, 'chapters' | 'chapterStages'>;
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({
		schema: S.Collections(previous),
		storage,
		autoConnect: false
	});
	const scope = await createTriplitRepository(oldClient as never).createScope({
		name: 'Tempience'
	});
	const scopes = await oldClient.fetch(oldClient.query('scopes'));
	const logs = await oldClient.fetch(oldClient.query('logs'));
	oldClient.disconnect();

	const events: string[] = [];
	const client = new TriplitClient({
		schema,
		storage,
		autoConnect: false,
		experimental: { onDatabaseInit: (_db, event) => void events.push(event.type) }
	});
	try {
		await client.ready;
		expect(events).toEqual(['SUCCESS']);
		expect(await client.fetch(client.query('scopes'))).toEqual(scopes);
		expect(await client.fetch(client.query('logs'))).toEqual(logs);
		const repository = createTriplitRepository(client);
		expect(await repository.listChapters()).toEqual([]);
		const chapter = await repository.createChapter({
			name: 'Глава',
			start: '2026-09-01T00:00:00+02:00',
			lineup: [{ scopeId: scope.id, level: 'focus' }]
		});
		expect((await repository.listChapters()).map((item) => item.id)).toEqual([chapter.id]);
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});
