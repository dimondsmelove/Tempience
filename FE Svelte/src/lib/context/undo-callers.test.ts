import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readContext } from '$lib/context/reload';
import { offerUndo } from '$lib/context/undo';
import { writeThenRead } from '$lib/context/write';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { RecordsReader, type RecordsRepository } from '$lib/state/Records/Records.svelte';
import { factFor, intentionOf, stateOf } from '$lib/state/TraceDraft/results.fixture';
import {
	flush,
	openDraftFixture,
	type DraftFixture
} from '$lib/state/TraceDraft/TraceDraft.fixture';
import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
import type { DataSpaceId } from '$lib/state/triplit/data-space';
import { UndoState } from '$lib/state/Undo/Undo.svelte';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { reloadForSaved } from '$lib/state/Workbench/open';
import { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';

let fx: DraftFixture;
let undo: UndoState;
const HERE = 'canonical' as DataSpaceId;

beforeEach(() => {
	fx = openDraftFixture();
	undo = new UndoState(60_000);
	undo.space = () => HERE;
});
afterEach(async () => {
	await fx.dispose();
});

const workbenchState = (): WorkbenchState =>
	new WorkbenchState(new ViewportState({ start: 0, end: 1 }));

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

/** The reader's repository with its trace read under the test's control. */
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

/** How many operations of the journal were written as an inverse. */
const inverses = async (): Promise<string[]> => {
	const logs = await fx.repository.listLogs();
	return [...new Set(logs.filter((log) => log.cause === 'undo').map((log) => log.operationId))];
};

describe('a Context command, its reading and the offer, through the real owners', () => {
	it('keeps the command committed when the workbench refuses its own read, and reads again on retry', async () => {
		const plan = await intentionOf(fx, 'План');
		const workbench = workbenchState();
		let snapshotFails = true;
		// The workbench keeps a refused read in its own status and resolves; this is the seam.
		const read = () =>
			reloadForSaved(workbench, () =>
				snapshotFails ? Promise.reject(new Error('Снимок недоступен.')) : emptySnapshot()
			);
		const outcome = await offerUndo({
			undo,
			space: HERE,
			repository: fx.repository,
			label: 'Запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(plan.id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			read
		});
		expect(outcome).toMatchObject({ written: true, refusal: null });
		expect((outcome.readFailure as Error).message).toContain('Снимок недоступен.');
		expect(workbench.status).toBe('error');
		// The deletion stands, and the offer to take it back stands with it.
		expect(
			(await fx.repository.listTraces(true)).find((row) => row.id === plan.id)?.isDeleted
		).toBe(true);
		expect(undo.pending?.label).toBe('Запись удалена');
		snapshotFails = false;
		await undo.undo();
		expect(undo.pending).toBeNull();
		expect(
			(await fx.repository.listTraces(true)).find((row) => row.id === plan.id)?.isDeleted
		).toBe(false);
		expect(await inverses()).toHaveLength(1);
	});

	it('writes the inverse once when the reading after it fails, and the retry only reads', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		const workbench = workbenchState();
		const records = new RecordsReader(readerRepository(() => readerFails));
		let readerFails = false;
		await records.load(plan.id);
		const read = () => readContext(workbench, records, emptySnapshot);
		await offerUndo({
			undo,
			space: HERE,
			repository: fx.repository,
			label: 'Запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(fact.trace.id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			read
		});
		expect(await stateOf(fx, plan.id)).toMatchObject({ outcome: null });
		// The record reader refuses its own read after the inverse has already committed.
		readerFails = true;
		await undo.undo();
		expect(undo.inverted).toBe(true);
		expect((undo.failure as Error).message).toContain('Хранилище не отвечает.');
		expect(undo.pending).not.toBeNull();
		// One inverse, one operation, and the statement is effective again.
		expect(await inverses()).toHaveLength(1);
		expect(await stateOf(fx, plan.id)).toMatchObject({ outcome: 'completed' });
		// Pressing again reads only; it never writes a second inverse.
		await undo.undo();
		expect(await inverses()).toHaveLength(1);
		readerFails = false;
		await undo.undo();
		expect([undo.pending, undo.inverted, undo.failure]).toEqual([null, false, null]);
		expect(await inverses()).toHaveLength(1);
		expect(records.result?.traceId).toBe(plan.id);
	});

	it('is pending work until every overlapping command has settled, not the last one', async () => {
		const plan = await intentionOf(fx, 'План');
		const other = await intentionOf(fx, 'Другой план');
		const gate = () => {
			let release = (): void => {};
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			return { held, release: () => release() };
		};
		// A slow command whose reading is still running, and a fast one that starts and settles
		// while the slow one is in flight: the gate must not open when the fast one is done.
		const slow = gate();
		const running = writeThenRead(
			() => fx.repository.setTraceDeleted(plan.id, true, 'user').then(() => {}),
			() => slow.held
		);
		await flush();
		expect(draftGuard.busy).toBe(true);
		await writeThenRead(
			() => fx.repository.setTraceDeleted(other.id, true, 'user').then(() => {}),
			() => Promise.resolve()
		);
		expect(draftGuard.busy).toBe(true);
		let left = false;
		draftGuard.exitReloading(() => {
			left = true;
		});
		await flush();
		expect(left).toBe(false);
		slow.release();
		await running;
		await draftGuard.settle();
		await flush();
		expect(left).toBe(true);
		expect(draftGuard.busy).toBe(false);
	});

	it('waits for the inverse asked for while the reading after its own command still runs', async () => {
		const plan = await intentionOf(fx, 'План');
		const gate = () => {
			let release = (): void => {};
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			return { held, release: () => release() };
		};
		// The reading after the command and the reading after the inverse, each held by the test.
		const readings = [gate(), gate()];
		let reads = 0;
		// The offer is installed at the commit, before the reading; the inverse is asked for
		// during that reading. Its own reading settles first, and the gate must still wait.
		const command = offerUndo({
			undo,
			space: HERE,
			repository: fx.repository,
			label: 'Запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(plan.id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			read: () => readings[reads++].held
		});
		await flush();
		expect(undo.pending?.label).toBe('Запись удалена');
		const taking = undo.undo();
		await flush();
		expect(undo.busy).toBe(true);
		expect(draftGuard.busy).toBe(true);
		let left = false;
		draftGuard.exitReloading(() => {
			left = true;
		});
		await flush();
		expect(left).toBe(false);
		// The inverse and its reading are over; the command's reading is not. Nothing may leave.
		readings[1].release();
		await taking;
		expect(undo.busy).toBe(false);
		await flush();
		expect([left, draftGuard.busy]).toEqual([false, true]);
		readings[0].release();
		await command;
		await draftGuard.settle();
		await flush();
		expect([left, draftGuard.busy]).toEqual([true, false]);
		expect(await inverses()).toHaveLength(1);
		expect(
			(await fx.repository.listTraces(true)).find((row) => row.id === plan.id)?.isDeleted
		).toBe(false);
	});

	it('is pending work the app-owned reload waits for, command and inverse alike', async () => {
		const plan = await intentionOf(fx, 'План');
		expect(draftGuard.busy).toBe(false);
		let release = (): void => {};
		let blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		// The reading this action was given; the test decides how long each turn of it takes.
		const running = offerUndo({
			undo,
			space: HERE,
			repository: fx.repository,
			label: 'Запись удалена',
			write: async () => {
				const { operation } = await fx.repository.setTraceDeleted(plan.id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			read: () => blocked
		});
		await flush();
		// A switch of the DataSpace or an update would reload the app; it waits for this write.
		expect(draftGuard.busy).toBe(true);
		let left = false;
		draftGuard.exitReloading(() => {
			left = true;
		});
		await flush();
		expect(left).toBe(false);
		release();
		await running;
		await draftGuard.settle();
		await flush();
		expect(left).toBe(true);
		// The inverse is the Context's work too, and the same gate waits for it.
		blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const taking = undo.undo();
		await flush();
		expect(draftGuard.busy).toBe(true);
		release();
		await taking;
		await draftGuard.settle();
		expect(draftGuard.busy).toBe(false);
		expect(await inverses()).toHaveLength(1);
	});
});
