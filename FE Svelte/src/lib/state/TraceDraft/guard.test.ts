import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TraceRecordSave } from '$lib/state/triplit/Traces/record';
import { flush, openDraftFixture, type DraftFixture } from './TraceDraft.fixture';
import { DraftExitGuard } from './guard.svelte';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

describe('DraftExitGuard', () => {
	it('passes an exit through at once without changes and asks once when a form changed', async () => {
		const guard = new DraftExitGuard();
		const draft = await fx.open({ mode: 'create' });
		const unregister = guard.register(draft);
		let runs = 0;
		guard.exit(() => (runs += 1));
		expect(runs).toBe(1);
		expect(guard.request).toBeNull();
		draft.title = 'Черновик';
		guard.exit(() => (runs += 1));
		await flush();
		expect(runs).toBe(1);
		expect(guard.request).not.toBeNull();
		// «Продолжить редактирование»: the form stays open with its input; nothing ran.
		guard.keep();
		await flush();
		expect(runs).toBe(1);
		expect(guard.request).toBeNull();
		expect([draft.phase, draft.title]).toEqual(['editing', 'Черновик']);
		// «Отбросить изменения»: the input ends and the requested transition completes once.
		guard.exit(() => (runs += 1));
		await flush();
		guard.discard();
		await flush();
		expect(runs).toBe(2);
		expect(draft.phase).toBe('closed');
		expect(guard.dirty).toBe(false);
		unregister();
	});

	it('waits for a pending save, then lets the exit follow the committed opening', async () => {
		const guard = new DraftExitGuard();
		let release!: () => void;
		const pending = new Promise<void>((resolve) => (release = resolve));
		const repository = {
			...fx.repository,
			saveTraceRecord: async (save: TraceRecordSave) => {
				await pending;
				return fx.repository.saveTraceRecord(save);
			}
		};
		const draft = await fx.open({ mode: 'create' }, { repository });
		guard.register(draft);
		draft.title = 'Отложенная запись';
		const events: string[] = [];
		const saving = draft.save(async () => {
			events.push('open-result');
		});
		expect([draft.phase, draft.dirty, guard.busy]).toEqual(['saving', false, true]);
		guard.exit(() => events.push('leave-space'));
		await flush();
		expect(events).toEqual([]);
		release();
		await saving;
		await flush();
		expect(events).toEqual(['open-result', 'leave-space']);
		expect(draft.phase).toBe('closed');
		expect((await fx.repository.listTraces()).map((row) => row.content)).toEqual([
			'Отложенная запись'
		]);
	});

	it('asks after a refused pending write instead of abandoning the input', async () => {
		const guard = new DraftExitGuard();
		let reject!: (cause: Error) => void;
		const pending = new Promise<never>((_resolve, fail) => (reject = fail));
		const draft = await fx.open(
			{ mode: 'create' },
			{ repository: { ...fx.repository, saveTraceRecord: () => pending } }
		);
		guard.register(draft);
		draft.title = 'Отклонённая запись';
		const saving = draft.save(async () => {});
		let left = 0;
		guard.exit(() => (left += 1));
		reject(new Error('Хранилище недоступно.'));
		await saving;
		await flush();
		expect([draft.phase, draft.failure?.message, draft.dirty]).toEqual([
			'editing',
			'Хранилище недоступно.',
			true
		]);
		expect(left).toBe(0);
		expect(guard.request).not.toBeNull();
		guard.keep();
		await flush();
		expect([left, draft.title]).toEqual([0, 'Отклонённая запись']);
		expect(await fx.repository.listTraces()).toEqual([]);
	});
});
