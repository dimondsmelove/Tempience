import { TriplitClient } from '@triplit/client';
import { afterEach, describe, expect, it } from 'vitest';
import { schema } from '../schema';
import { createBackupRepository } from '../Backup/Backup';
import { parseDataSpaceBackup } from '../Backup/parse';
import { createImportedDataSpace } from '../data-space';
import { summaryLeaves } from '$lib/model/TraceForm/summary-fields';
import { createPracticeSettingsRepository } from './PracticeSettings';
import { practiceFields } from './source';
import type { TraceKindV } from '../types';

const clients: TriplitClient<typeof schema>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});
const clientOf = () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return client;
};
const open = async () => {
	const client = clientOf();
	await client.ready;
	const now = '2026-10-28T10:00:00Z';
	await client.insert('scopes', {
		id: 'serbian',
		name: 'Сербский',
		isDeleted: false,
		createdAt: now,
		updatedAt: now
	});
	await client.insert('traceKinds', {
		id: 'time',
		name: 'Time',
		currentKindVId: 'time-v1',
		createdAt: now,
		updatedAt: now
	});
	const version: TraceKindV = {
		id: 'time-v1',
		kindId: 'time',
		generation: 1,
		parentKindVIds: [],
		createdAt: now,
		createdByDeviceId: 'test',
		dataSchema: {
			type: 'object',
			properties: {
				title: { type: 'string' },
				note: { type: 'string' },
				minutes: { type: 'integer', minimum: 1 }
			}
		}
	};
	await client.insert('traceKindVersions', version);
	return {
		client,
		version,
		repo: createPracticeSettingsRepository(client),
		source: { id: 'source' as const, kindId: 'time', path: ['minutes'], scopeIds: ['serbian'] }
	};
};

describe('practice source settings', () => {
	it('finds a numeric field beyond the row summary and persists exactly one source', async () => {
		const fx = await open();
		expect(summaryLeaves(fx.version)).toHaveLength(2);
		expect(practiceFields(fx.version).map((leaf) => leaf.path)).toEqual([['minutes']]);
		await fx.repo.setPracticeSource(fx.source);
		await fx.repo.setPracticeSource(fx.source);
		expect(await createPracticeSettingsRepository(fx.client).getPracticeSource()).toEqual(
			fx.source
		);
		expect(await fx.client.fetch(fx.client.query('practiceSettings'))).toHaveLength(1);
	});
	it('refuses nonnumeric fields and missing activities without replacing the saved source', async () => {
		const fx = await open();
		await fx.repo.setPracticeSource(fx.source);
		await expect(fx.repo.setPracticeSource({ ...fx.source, path: ['title'] })).rejects.toThrow();
		await expect(
			fx.repo.setPracticeSource({ ...fx.source, scopeIds: ['missing'] })
		).rejects.toThrow();
		expect(await fx.repo.getPracticeSource()).toEqual(fx.source);
	});
	it('exports and restores the source and accepts backups predating the setting', async () => {
		const fx = await open();
		await fx.repo.setPracticeSource(fx.source);
		const backup = await createBackupRepository(
			fx.client,
			createImportedDataSpace('Source')
		).export();
		const target = clientOf();
		await createBackupRepository(target, createImportedDataSpace('Copy')).restore(backup);
		expect(await createPracticeSettingsRepository(target).getPracticeSource()).toEqual(fx.source);
		const older = {
			...backup,
			collections: Object.fromEntries(
				Object.entries(backup.collections).filter(
					([key]) => key !== 'practiceSettings' && key !== 'practiceTargets'
				)
			)
		};
		expect(parseDataSpaceBackup(older).collections.practiceSettings).toEqual([]);
		const bad = structuredClone(backup);
		bad.collections.practiceSettings[0].scopeIds = ['absent'];
		expect(() => parseDataSpaceBackup(bad)).toThrow();
	});
});
