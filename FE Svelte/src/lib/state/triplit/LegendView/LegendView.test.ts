import { TriplitClient, Schema as S } from '@triplit/client';
import { BTreeKVStore } from '@triplit/db/storage/memory-btree';
import { expect, it } from 'vitest';
import { schema } from '../schema';
import { createBackupRepository } from '../Backup/Backup';
import { createImportedDataSpace } from '../data-space';
import { createLegendViewRepository } from './LegendView';

it('reads defaults, writes and overwrites a single row, and ignores unknown keys', async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	try {
		const repo = createLegendViewRepository(client);
		expect(await repo.getLegendView()).toEqual({ hiddenLegend: [], soloLegend: null });
		await repo.setLegendView({ hiddenLegend: ['fact', 'open'], soloLegend: 'intent' });
		expect(await repo.getLegendView()).toEqual({
			hiddenLegend: ['fact', 'open'],
			soloLegend: 'intent'
		});
		await repo.setLegendView({ hiddenLegend: ['interval'], soloLegend: null });
		expect(await client.fetch(client.query('legendView'))).toEqual([
			{ id: 'legend', hiddenLegend: ['interval'], soloLegend: '' }
		]);
		await client.update('legendView', 'legend', {
			hiddenLegend: ['fact', 'future', 42, 'fact'],
			soloLegend: 'future'
		});
		expect(await repo.getLegendView()).toEqual({ hiddenLegend: ['fact'], soloLegend: null });
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('opens existing data without the collection and starts empty', async () => {
	const previous = Object.fromEntries(
		Object.entries(schema).filter(([name]) => name !== 'legendView')
	) as Omit<typeof schema, 'legendView'>;
	const storage = new BTreeKVStore();
	const old = new TriplitClient({ schema: S.Collections(previous), storage, autoConnect: false });
	await old.insert('uiAppearance', { id: 'appearance', themeId: 'theme', mode: 'light' });
	old.disconnect();
	const client = new TriplitClient({ schema, storage, autoConnect: false });
	try {
		await client.ready;
		expect(await client.fetch(client.query('uiAppearance'))).toHaveLength(1);
		expect(await client.fetch(client.query('legendView'))).toEqual([]);
		expect(await createLegendViewRepository(client).getLegendView()).toEqual({
			hiddenLegend: [],
			soloLegend: null
		});
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('exports and restores legend settings', async () => {
	const source = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	const target = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	try {
		await createLegendViewRepository(source).setLegendView({
			hiddenLegend: ['open'],
			soloLegend: 'fact'
		});
		const backup = await createBackupRepository(source, createImportedDataSpace('Source')).export();
		expect(backup.collections.legendView).toEqual([
			{ id: 'legend', hiddenLegend: ['open'], soloLegend: 'fact' }
		]);
		await createBackupRepository(target, createImportedDataSpace('Target')).restore(backup);
		expect(await createLegendViewRepository(target).getLegendView()).toEqual({
			hiddenLegend: ['open'],
			soloLegend: 'fact'
		});
	} finally {
		await source.clear({ full: true });
		source.disconnect();
		await target.clear({ full: true });
		target.disconnect();
	}
});
