import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { RecordsReader, type RecordsRepository } from '$lib/state/Records/Records.svelte';
import { openDraftFixture, type DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import { intentionOf } from '$lib/state/TraceDraft/results.fixture';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
import { readContext } from './reload';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
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

/** The repository the reader uses, with its trace read under the test's control. */
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

describe('reading what a Context command changed', () => {
	it('reports the workbench refusing its own read, through its own error state', async () => {
		const workbench = workbenchState();
		const records = new RecordsReader(readerRepository(() => false));
		// WorkbenchState.load catches and resolves with status 'error'; that must still be a failure
		// for a caller, which is what the accepted `reloadForSaved` seam already decides.
		await expect(
			readContext(workbench, records, () => Promise.reject(new Error('Снимок недоступен.')))
		).rejects.toThrow('Снимок недоступен.');
		expect(workbench.status).toBe('error');
	});

	it('reports the record reader refusing its own read, which it also keeps to itself', async () => {
		const plan = await intentionOf(fx, 'План');
		const workbench = workbenchState();
		let failing = true;
		const records = new RecordsReader(readerRepository(() => failing));
		await records.load(plan.id);
		expect(records.error).not.toBe('');
		expect(records.result).toBeNull();
		await expect(readContext(workbench, records, emptySnapshot)).rejects.toThrow(
			'Хранилище не отвечает.'
		);
		// The same reading, repeated once the storage answers again, recovers on its own.
		failing = false;
		await expect(readContext(workbench, records, emptySnapshot)).resolves.toBeUndefined();
		expect(records.error).toBe('');
		expect(records.result?.result?.intentionId).toBe(plan.id);
	});
});
