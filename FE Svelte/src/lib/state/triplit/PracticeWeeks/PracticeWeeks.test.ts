import { TriplitClient } from '@triplit/client';
import { afterEach, describe, expect, it } from 'vitest';
import { createBackupRepository } from '../Backup/Backup';
import { parseDataSpaceBackup } from '../Backup/parse';
import { createImportedDataSpace } from '../data-space';
import { schema } from '../schema';
import { createPracticeWeekPlansRepository } from './PracticeWeeks';
import { MAX_WEEKLY_MINUTES } from '../PracticeTargets/targets';

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
	const repo = createPracticeWeekPlansRepository(client, () => new Date(now));
	return { client, repo };
};

describe('practice week plans', () => {
	it('keeps weeks independent, leaves an unplanned week empty, and edits past and future weeks', async () => {
		const fx = await open();
		const past = '2026-09-28';
		const middle = '2026-10-05';
		const future = '2026-11-02';
		const legacyTarget = {
			id: 'legacy-target',
			sourceId: 'source',
			scopeId: 'serbian',
			minutesPerWeek: 75,
			effectiveFromWeek: past,
			createdAt: '2026-09-28T00:00:00.000Z',
			isDeleted: false
		};
		await fx.client.insert('practiceTargets', legacyTarget);
		expect(await fx.repo.getPracticeWeekPlan(past)).toBeNull();
		expect(await fx.repo.getPracticeWeekPlan(middle)).toBeNull();
		await fx.repo.savePracticeWeekPlan(past, {
			scopeIds: ['serbian'],
			goals: { serbian: 120 }
		});
		await fx.repo.savePracticeWeekPlan(future, { scopeIds: ['piano'] });
		expect(await fx.repo.getPracticeWeekPlan(middle)).toBeNull();
		expect(await fx.repo.getPracticeWeekPlan(past)).toMatchObject({
			week: past,
			scopeIds: ['serbian'],
			goals: { serbian: 120 }
		});
		expect(await fx.repo.getPracticeWeekPlan(future)).toMatchObject({
			week: future,
			scopeIds: ['piano'],
			goals: {}
		});

		await fx.repo.savePracticeWeekPlan(past, { scopeIds: ['serbian'] });
		const plans = await fx.repo.listPracticeWeekPlans();
		expect(plans.map((plan) => plan.week)).toEqual([past, future]);
		expect(plans[0].goals).toEqual({ serbian: 120 });
		expect(plans[1].scopeIds).toEqual(['piano']);
		expect(await fx.client.fetch(fx.client.query('practiceTargets'))).toEqual([legacyTarget]);
	});

	it('retains goals on repeated saves unless goals are explicitly replaced', async () => {
		const fx = await open();
		const week = '2026-10-05';
		await fx.repo.savePracticeWeekPlan(week, {
			scopeIds: ['serbian', 'piano'],
			goals: { serbian: MAX_WEEKLY_MINUTES, piano: 60 }
		});
		await fx.repo.savePracticeWeekPlan(week, { scopeIds: ['serbian', 'piano'] });
		expect((await fx.repo.getPracticeWeekPlan(week))?.goals).toEqual({
			serbian: MAX_WEEKLY_MINUTES,
			piano: 60
		});
		await fx.repo.savePracticeWeekPlan(week, {
			scopeIds: ['serbian'],
			goals: { serbian: 30 }
		});
		expect((await fx.repo.getPracticeWeekPlan(week))?.goals).toEqual({ serbian: 30 });
	});

	it('preserves a deleted Scope already referenced by a plan but rejects adding it to another week', async () => {
		const fx = await open();
		const week = '2026-10-05';
		await fx.repo.savePracticeWeekPlan(week, { scopeIds: ['serbian'], goals: { serbian: 90 } });
		await fx.client.update('scopes', 'serbian', (scope) => {
			scope.isDeleted = true;
		});
		await fx.repo.savePracticeWeekPlan(week, { scopeIds: ['serbian'] });
		expect(await fx.repo.getPracticeWeekPlan(week)).toMatchObject({
			scopeIds: ['serbian'],
			goals: { serbian: 90 }
		});
		await expect(
			fx.repo.savePracticeWeekPlan('2026-10-12', { scopeIds: ['serbian'] })
		).rejects.toThrow();
	});

	it('rejects invalid week keys, Scope sets and goal boundaries without writing', async () => {
		const fx = await open();
		for (const week of ['2026-10-06', '2026-02-30', '20261005'])
			await expect(fx.repo.savePracticeWeekPlan(week, { scopeIds: [] })).rejects.toThrow();
		await expect(
			fx.repo.savePracticeWeekPlan('2026-10-05', { scopeIds: ['serbian', 'serbian'] })
		).rejects.toThrow();
		await expect(
			fx.repo.savePracticeWeekPlan('2026-10-05', { scopeIds: ['missing'] })
		).rejects.toThrow();
		for (const minutes of [0, -1, 1.5, MAX_WEEKLY_MINUTES + 1])
			await expect(
				fx.repo.savePracticeWeekPlan('2026-10-05', {
					scopeIds: ['serbian'],
					goals: { serbian: minutes }
				})
			).rejects.toThrow();
		await expect(
			fx.repo.savePracticeWeekPlan('2026-10-05', {
				scopeIds: ['serbian'],
				goals: { piano: 60 }
			})
		).rejects.toThrow();
		expect(await fx.repo.listPracticeWeekPlans()).toEqual([]);
	});

	it('exports and restores plans, reads older profiles without plans, and validates Scope references', async () => {
		const fx = await open();
		await fx.repo.savePracticeWeekPlan('2026-09-28', {
			scopeIds: ['serbian'],
			goals: { serbian: 90 }
		});
		await fx.repo.savePracticeWeekPlan('2026-11-02', { scopeIds: ['piano'] });
		const backup = await createBackupRepository(
			fx.client,
			createImportedDataSpace('Source')
		).export();
		expect(backup.collections.practiceWeekPlans).toHaveLength(2);
		const target = clientOf();
		await createBackupRepository(target, createImportedDataSpace('Copy')).restore(backup);
		expect(await createPracticeWeekPlansRepository(target).listPracticeWeekPlans()).toEqual(
			await fx.repo.listPracticeWeekPlans()
		);

		const older = {
			...backup,
			collections: Object.fromEntries(
				Object.entries(backup.collections).filter(([key]) => key !== 'practiceWeekPlans')
			)
		};
		expect(parseDataSpaceBackup(older).collections.practiceWeekPlans).toEqual([]);
		const missingScope = structuredClone(backup);
		missingScope.collections.scopes = missingScope.collections.scopes.filter(
			(scope) => scope.id !== 'serbian'
		);
		expect(() => parseDataSpaceBackup(missingScope)).toThrow(/missing Scope/i);
		const badWeek = structuredClone(backup);
		badWeek.collections.practiceWeekPlans[0].id = '2026-10-06';
		expect(() => parseDataSpaceBackup(badWeek)).toThrow();
	});
});
