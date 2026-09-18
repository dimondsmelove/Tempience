import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { RecordsReader, type RecordsRepository } from '$lib/state/Records/Records.svelte';
import type { LogActor } from '$lib/state/triplit/types';
import { intentionOf } from '$lib/state/TraceDraft/results.fixture';
import { openDraftFixture, type DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
import { RestoreEpisodes, RestoreState } from './restore.svelte';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const emptySnapshot = (): Promise<ExplorerSnapshot> =>
	Promise.resolve({
		traces: [],
		scopes: [],
		periods: [],
		intersections: [],
		sources: [],
		assertions: [],
		scopeSegments: []
	} as unknown as ExplorerSnapshot);

/** The reader's repository with its record read under the test's control. */
const readerRepository = (fail: () => boolean): RecordsRepository => ({
	readTraceRow: (id: string) =>
		fail() ? Promise.reject(new Error('Хранилище не отвечает.')) : fx.repository.readTraceRow(id),
	listIntersectionsTouching: fx.repository.listIntersectionsTouching,
	listIntentionAssessmentsFor: fx.repository.listIntentionAssessmentsFor,
	listTraceHeads: fx.repository.listTraceHeads,
	listScopes: fx.repository.listScopes,
	listTraceKinds: fx.repository.listTraceKinds,
	listTraceKindVersions: fx.repository.listTraceKindVersions,
	// These tests drive the reads by hand; the live subscriptions are exercised by their own test.
	subscribeTraceRow: () => () => {},
	subscribeIntersectionsTouching: () => () => {},
	subscribeIntentionAssessmentsFor: () => () => {},
	subscribeTraceHeads: () => () => {},
	subscribeLogsFor: () => () => {}
});

/** How many times the restore was issued to the repository, whatever the reading did. */
const counting = () => {
	let writes = 0;
	return {
		writes: () => writes,
		repository: {
			setTraceDeleted: (id: string, deleted: boolean, actor?: LogActor) => {
				writes += 1;
				return fx.repository.setTraceDeleted(id, deleted, actor);
			}
		}
	};
};

const deleted = async (id: string): Promise<boolean | undefined> =>
	(await fx.repository.listTraces(true)).find((row) => row.id === id)?.isDeleted;

describe('bringing a record back through the owners that keep a refused read', () => {
	it('keeps the record back when the timeline refuses its read, and reads again on retry', async () => {
		const plan = await intentionOf(fx, 'План');
		await fx.repository.setTraceDeleted(plan.id, true, 'user');
		const workbench = new WorkbenchState(new ViewportState({ start: 0, end: 1 }));
		const records = new RecordsReader(readerRepository(() => false));
		await records.load(plan.id);
		let snapshotFails = true;
		const repo = counting();
		const restore = new RestoreState(plan.id, null, {
			repository: repo.repository,
			workbench,
			records,
			loader: () =>
				snapshotFails ? Promise.reject(new Error('Снимок недоступен.')) : emptySnapshot()
		});
		await restore.run();
		// The record is back: the write was accepted and nothing will write it again.
		expect(await deleted(plan.id)).toBe(false);
		expect(restore.committed).toBe(true);
		expect(restore.refusal).toBeNull();
		// The workbench kept the refused read in its own state; this boundary raised it.
		expect(workbench.status).toBe('error');
		expect((restore.readFailure as Error).message).toContain('Снимок недоступен.');
		// Asking again reads only.
		await restore.retry();
		expect((restore.readFailure as Error).message).toContain('Снимок недоступен.');
		snapshotFails = false;
		await restore.retry();
		expect(restore.readFailure).toBeNull();
		expect(workbench.status).toBe('ready');
		expect(workbench.selection.traceId).toBe(plan.id);
		expect(repo.writes()).toBe(1);
		// A second run after the commit is nothing: the restore is not issued twice either.
		await restore.run();
		expect(repo.writes()).toBe(1);
	});

	it('keeps the record back when its own reader refuses, and reads again on retry', async () => {
		const plan = await intentionOf(fx, 'План');
		await fx.repository.setTraceDeleted(plan.id, true, 'user');
		const workbench = new WorkbenchState(new ViewportState({ start: 0, end: 1 }));
		let readerFails = false;
		const records = new RecordsReader(readerRepository(() => readerFails));
		await records.load(plan.id);
		const repo = counting();
		const restore = new RestoreState(plan.id, null, {
			repository: repo.repository,
			workbench,
			records,
			loader: emptySnapshot
		});
		readerFails = true;
		await restore.run();
		expect(await deleted(plan.id)).toBe(false);
		expect(restore.committed).toBe(true);
		// The reader kept the refused read in its own state; this boundary raised it.
		expect(records.error).toContain('Хранилище не отвечает.');
		expect((restore.readFailure as Error).message).toContain('Хранилище не отвечает.');
		readerFails = false;
		await restore.retry();
		expect([restore.readFailure, records.error]).toEqual([null, '']);
		expect(records.result?.trace?.isDeleted).toBe(false);
		expect(repo.writes()).toBe(1);
	});

	it('gives a record deleted again a way back again, and the earlier one never writes again', async () => {
		const plan = await intentionOf(fx, 'План');
		const workbench = new WorkbenchState(new ViewportState({ start: 0, end: 1 }));
		let readerFails = false;
		const records = new RecordsReader(readerRepository(() => readerFails));
		const repo = counting();
		const episodes = new RestoreEpisodes(() => ({
			repository: repo.repository,
			workbench,
			records,
			loader: emptySnapshot
		}));
		/** What the Context asks for: the selected record and the deletion its reader shows. */
		const shown = async (): Promise<RestoreState | null> => {
			await records.load(plan.id);
			const trace = records.result?.trace;
			return episodes.for(plan.id, trace?.isDeleted ? (trace.lifecycleId ?? 'unstamped') : null);
		};
		// Nothing deleted yet: a way back exists for the selection, and it is kept while the
		// record is here.
		const idle = await shown();
		expect(idle).not.toBeNull();
		expect(await shown()).toBe(idle);
		// Deleted: the deletion is the record's lifecycle revision, and the way back is its own.
		const first = await fx.repository.setTraceDeleted(plan.id, true, 'user');
		const one = (await shown())!;
		expect(one).not.toBe(idle);
		expect(one.deletion).toBe(first.operation!.id);
		// Brought back with a reading that fails: committed, said so, and kept across the return.
		readerFails = true;
		await one.run();
		readerFails = false;
		expect([one.committed, one.readFailure !== null]).toEqual([true, true]);
		expect(await deleted(plan.id)).toBe(false);
		expect(await shown()).toBe(one);
		expect(repo.writes()).toBe(1);
		// Deleted again — on another device, say: a new deletion, a new way back.
		const second = await fx.repository.setTraceDeleted(plan.id, true, 'user');
		expect(second.operation!.id).not.toBe(first.operation!.id);
		const two = (await shown())!;
		expect(two).not.toBe(one);
		expect([two.deletion, two.committed]).toEqual([second.operation!.id, false]);
		await two.run();
		expect(await deleted(plan.id)).toBe(false);
		expect(repo.writes()).toBe(2);
		// The earlier way back is over: neither its retry nor another run of it writes anything,
		// however its reading went.
		readerFails = true;
		await one.retry();
		await one.run();
		readerFails = false;
		expect(repo.writes()).toBe(2);
		expect(one.committed).toBe(true);
		// Another record selected, then this one again: a way back of its own, as before.
		expect(episodes.for('other', null)?.traceId).toBe('other');
		expect((await shown())?.traceId).toBe(plan.id);
	});

	it('says a refused restore where it was asked for, and may be asked for again', async () => {
		const workbench = new WorkbenchState(new ViewportState({ start: 0, end: 1 }));
		const records = new RecordsReader(readerRepository(() => false));
		const repo = counting();
		const restore = new RestoreState('missing', null, {
			repository: repo.repository,
			workbench,
			records,
			loader: emptySnapshot
		});
		await restore.run();
		expect(restore.committed).toBe(false);
		expect((restore.refusal as Error).message).toContain('missing');
		expect(restore.readFailure).toBeNull();
		// Nothing was committed, so asking again is a new restore, not a reading.
		await restore.retry();
		expect(repo.writes()).toBe(1);
		await restore.run();
		expect(repo.writes()).toBe(2);
	});
});
