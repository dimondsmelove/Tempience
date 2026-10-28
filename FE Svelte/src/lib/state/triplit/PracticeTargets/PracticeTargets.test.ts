import { TriplitClient } from '@triplit/client';
import { afterEach, describe, expect, it } from 'vitest';
import { schema } from '../schema';
import { createBackupRepository } from '../Backup/Backup';
import { parseDataSpaceBackup } from '../Backup/parse';
import { createImportedDataSpace } from '../data-space';
import { createPracticeTargetsRepository } from './PracticeTargets';
import { weeklyTargetFor } from './targets';

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
	const now = '2026-10-01T10:00:00Z';
	for (const id of ['serbian', 'piano'])
		await client.insert('scopes', {
			id,
			name: id,
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
	await client.insert('traceKindVersions', {
		id: 'time-v1',
		kindId: 'time',
		generation: 1,
		parentKindVIds: [],
		createdAt: now,
		createdByDeviceId: 'test',
		dataSchema: { type: 'object', properties: { minutes: { type: 'integer' } } }
	});
	await client.insert('practiceSettings', {
		id: 'source',
		kindId: 'time',
		path: ['minutes'],
		scopeIds: ['serbian', 'piano']
	});
	let clock = new Date('2026-10-21T10:00:00Z');
	const repo = createPracticeTargetsRepository(client, {
		now: () => clock,
		timezone: () => 'Europe/Belgrade'
	});
	return { client, repo, at: (iso: string) => (clock = new Date(iso)) };
};

describe('practice targets repository', () => {
	it('appends budgets from the current week and keeps earlier weeks as they were', async () => {
		const fx = await open();
		await fx.repo.setWeeklyTarget({ scopeId: 'serbian', minutesPerWeek: 120 });
		fx.at('2026-10-28T10:00:00Z');
		await fx.repo.setWeeklyTarget({ scopeId: 'serbian', minutesPerWeek: 180 });
		await fx.repo.setWeeklyTarget({ scopeId: 'piano', minutesPerWeek: 60 });
		const rows = await fx.repo.listPracticeTargets();
		expect(rows).toHaveLength(3);
		expect(rows.map((row) => row.effectiveFromWeek).toSorted()).toEqual([
			'2026-10-19',
			'2026-10-26',
			'2026-10-26'
		]);
		expect(weeklyTargetFor(rows, 'serbian', '2026-10-22')).toBe(120);
		expect(weeklyTargetFor(rows, 'serbian', '2026-10-28')).toBe(180);
		expect(weeklyTargetFor(rows, 'piano', '2026-10-22')).toBeNull();
		fx.at('2026-10-29T10:00:00Z');
		await fx.repo.setWeeklyTarget({ scopeId: 'serbian', minutesPerWeek: null });
		const cleared = await fx.repo.listPracticeTargets();
		expect(weeklyTargetFor(cleared, 'serbian', '2026-10-28')).toBeNull();
		expect(weeklyTargetFor(cleared, 'serbian', '2026-10-22')).toBe(120);
	});
	it('refuses invalid minutes and activities outside the source', async () => {
		const fx = await open();
		await expect(
			fx.repo.setWeeklyTarget({ scopeId: 'serbian', minutesPerWeek: 0 })
		).rejects.toThrow();
		await expect(
			fx.repo.setWeeklyTarget({ scopeId: 'missing', minutesPerWeek: 30 })
		).rejects.toThrow();
		expect(await fx.repo.listPracticeTargets()).toEqual([]);
	});
	it('delivers changes to subscribers', async () => {
		const fx = await open();
		const seen: number[] = [];
		const stop = fx.repo.subscribePracticeTargets(
			(rows) => seen.push(rows.length),
			(cause) => {
				throw cause;
			}
		);
		await fx.repo.setWeeklyTarget({ scopeId: 'serbian', minutesPerWeek: 45 });
		await new Promise((resolve) => setTimeout(resolve, 20));
		stop();
		expect(seen.at(-1)).toBe(1);
	});
	it('exports, restores and accepts backups that predate budgets', async () => {
		const fx = await open();
		await fx.repo.setWeeklyTarget({ scopeId: 'serbian', minutesPerWeek: 90 });
		const backup = await createBackupRepository(fx.client, createImportedDataSpace('S')).export();
		expect(backup.collections.practiceTargets).toHaveLength(1);
		const target = clientOf();
		await createBackupRepository(target, createImportedDataSpace('C')).restore(backup);
		expect(await createPracticeTargetsRepository(target).listPracticeTargets()).toEqual(
			await fx.repo.listPracticeTargets()
		);
		const older = {
			...backup,
			collections: Object.fromEntries(
				Object.entries(backup.collections).filter(([key]) => key !== 'practiceTargets')
			)
		};
		expect(parseDataSpaceBackup(older).collections.practiceTargets).toEqual([]);
		const bad = structuredClone(backup);
		bad.collections.practiceTargets[0].scopeId = 'absent';
		expect(() => parseDataSpaceBackup(bad)).toThrow();
		const malformed = structuredClone(backup);
		malformed.collections.practiceTargets[0].effectiveFromWeek = '2026-10-21';
		expect(() => parseDataSpaceBackup(malformed)).toThrow();
	});
});
