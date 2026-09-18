import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TraceRecordSave } from '$lib/state/triplit/Traces/record';
import { openDraftFixture, operationLogs, type DraftFixture } from './TraceDraft.fixture';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const traceIds = async () => (await fx.repository.listTraces()).map((row) => row.id);

describe('TraceDraftState — the save boundary', () => {
	it('keeps the input after a refused write and retries only on an explicit second save', async () => {
		// A write that fails below the repository's own rules, as a storage or sync fault does.
		let refuse = true;
		const repository = {
			...fx.repository,
			saveTraceRecord: async (save: TraceRecordSave) => {
				if (refuse) throw new Error('Хранилище недоступно.');
				return fx.repository.saveTraceRecord(save);
			}
		};
		const draft = await fx.open({ mode: 'create' }, { repository });
		draft.title = 'Прогулка';
		draft.description = 'вдоль реки';
		let opened = 0;
		const open = async () => {
			opened += 1;
		};
		await draft.save(open);
		expect(draft.phase).toBe('editing');
		expect(draft.failure).toMatchObject({ code: null, message: 'Хранилище недоступно.' });
		expect([draft.title, draft.description]).toEqual(['Прогулка', 'вдоль реки']);
		expect(draft.commit).toBeNull();
		expect(await traceIds()).toEqual([]);
		// No dummy edit is needed: the same valid input is ready for the same button.
		expect(draft.canSave).toBe(true);
		refuse = false;
		expect(opened).toBe(0);
		await draft.save(open);
		expect(draft.phase).toBe('closed');
		expect(draft.failure).toBeNull();
		expect(opened).toBe(1);
		expect(await traceIds()).toEqual([draft.commit!.id]);
	});

	it('issues one mutation for a double click', async () => {
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'Дважды';
		const opened: string[] = [];
		const open = async (id: string) => {
			opened.push(id);
		};
		const first = draft.save(open);
		expect(draft.phase).toBe('saving');
		expect(draft.canSave).toBe(false);
		const second = draft.save(open);
		await Promise.all([first, second]);
		expect(opened).toEqual([draft.commit!.id]);
		expect(await traceIds()).toEqual([draft.commit!.id]);
		expect(await operationLogs(fx, draft.commit!.operation.id)).toEqual(['trace:created']);
		expect(
			(await fx.repository.listLogs()).filter((log) => log.entityType === 'trace')
		).toHaveLength(1);
	});

	it('latches the committed id before opening and retries opening the same id without writing', async () => {
		const draft = await fx.open({ mode: 'create' });
		draft.title = 'После сохранения';
		let failOpening = true;
		const opened: string[] = [];
		const open = async (id: string) => {
			opened.push(id);
			// What the entry point does when Workbench.load resolves with status 'error'.
			if (failOpening) throw new Error('Не удалось прочитать repository.');
		};
		await draft.save(open);
		expect(draft.phase).toBe('openFailed');
		expect(draft.failure?.message).toBe('Не удалось прочитать repository.');
		const committed = draft.commit!;
		expect(opened).toEqual([committed.id]);
		expect(draft.dirty).toBe(false);
		expect(draft.canSave).toBe(false);
		await draft.save(open);
		expect(await traceIds()).toEqual([committed.id]);
		failOpening = false;
		await draft.retryOpen();
		expect(draft.phase).toBe('closed');
		expect(opened).toEqual([committed.id, committed.id]);
		expect(draft.commit).toEqual(committed);
		expect(await traceIds()).toEqual([committed.id]);
		expect(await operationLogs(fx, committed.operation.id)).toEqual(['trace:created']);
		await draft.retryOpen();
		expect(opened).toHaveLength(2);
	});
});
