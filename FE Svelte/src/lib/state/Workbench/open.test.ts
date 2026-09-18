import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDraftFixture, type DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { openCapturedTrace, reloadForSaved } from './open';
import { buildRepositoryExplorerSnapshot } from './snapshot';
import { WorkbenchState } from './Workbench.svelte';

const window = {
	start: Date.parse('2026-09-01T00:00:00Z'),
	end: Date.parse('2026-09-30T00:00:00Z')
};

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

describe('opening a committed record through the real workbench load', () => {
	it('turns a read that Workbench.load caught into a failed opening, retried for the same id', async () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		workbench.capture = true;
		let refuse = true;
		// The real snapshot builder over the real repository; only its first read is refused.
		const loader = () =>
			buildRepositoryExplorerSnapshot(
				{
					...fx.repository,
					listTraces: async (includeDeleted?: boolean) => {
						if (refuse) throw new Error('synthetic read refusal');
						return fx.repository.listTraces(includeDeleted);
					}
				},
				'test'
			);
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Открыть после сохранения';
		await draft.save((id) => openCapturedTrace(workbench, id, loader));
		// Workbench.load resolved with status 'error'; the form knows the record is saved, not opened.
		expect([workbench.status, workbench.error]).toEqual([
			'error',
			'Непредвиденная ошибка: synthetic read refusal'
		]);
		expect([draft.phase, draft.failure?.message]).toEqual(['openFailed', 'synthetic read refusal']);
		expect(workbench.capture).toBe(true);
		expect(workbench.selection.traceId).toBeNull();
		const committed = draft.commit!;
		expect((await fx.repository.listTraces()).map((row) => row.id)).toEqual([committed.id]);
		refuse = false;
		await draft.retryOpen();
		expect([workbench.status, workbench.error]).toEqual(['ready', null]);
		expect(workbench.snapshot.traces.map((row) => row.id)).toEqual([committed.id]);
		expect(workbench.selection.traceId).toBe(committed.id);
		expect(workbench.capture).toBe(false);
		expect([draft.phase, draft.commit]).toEqual(['closed', committed]);
		expect((await fx.repository.listTraces()).map((row) => row.id)).toEqual([committed.id]);
		expect(
			(await fx.repository.listLogs()).filter((log) => log.operationId === committed.operation.id)
		).toHaveLength(1);
	});

	it('waits with the timeline while a history stands in the centre, and reads it when shown again', async () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		await fx.repository.createScope({ name: 'Scope' });
		let loads = 0;
		const loader = () => {
			loads += 1;
			return buildRepositoryExplorerSnapshot(fx.repository, 'test');
		};
		workbench.forms.showHistory('kind');
		await reloadForSaved(workbench, loader);
		expect([loads, workbench.stale]).toEqual([0, true]);
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Из истории';
		await draft.save((id) => openCapturedTrace(workbench, id, loader));
		// The record is selected and the form closed, the timeline behind untouched still.
		expect([loads, workbench.stale, workbench.capture]).toEqual([0, true, false]);
		expect(workbench.selection.traceId).toBe(draft.commit!.id);
		workbench.forms.showTimeline();
		expect(workbench.timelineCovered).toBe(false);
		await workbench.load(loader);
		expect([loads, workbench.stale, workbench.status]).toEqual([1, false, 'ready']);
		expect(workbench.snapshot.traces.map((row) => row.id)).toEqual([draft.commit!.id]);
	});

	it('a plain reload for an edit resolves when the loader succeeds', async () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		await fx.repository.createScope({ name: 'Scope' });
		await expect(
			reloadForSaved(workbench, () => buildRepositoryExplorerSnapshot(fx.repository, 'test'))
		).resolves.toBeUndefined();
		expect(workbench.status).toBe('ready');
		expect(workbench.snapshot.scopes).toHaveLength(1);
	});
});
