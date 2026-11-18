import { vi } from 'vitest';
vi.mock('$lib/state/triplit', () => ({
	tempienceRepository: { deleteIntention: vi.fn(), undoOperation: vi.fn() }
}));
vi.mock('$lib/state/triplit/client', () => ({ activeDataSpace: { id: 'test-space' } }));
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCommand, deleteIntentionWithUndo } from './deleteCommand';
import { tempienceRepository } from '$lib/state/triplit';
import { locale } from '$lib/state/Locale/Locale.svelte';
import type { UndoState } from '$lib/state/Undo/Undo.svelte';
import type { DeletePlan, DeleteResult } from './types';

const plan = (descendantCount: number): DeletePlan => ({
	deleteIds: ['root', ...Array.from({ length: descendantCount }, (_, index) => `child-${index}`)],
	keptShared: [],
	descendantCount
});
const deleted: DeleteResult = { ok: true, operationId: 'op', deletedIds: ['root'] };
const changed: DeleteResult = { ok: false, reason: 'plan_changed' };

describe('deleteCommand', () => {
	it('returns a successful deletion without refreshing', async () => {
		const refresh = vi.fn();
		await expect(
			deleteCommand({
				id: 'root',
				mode: 'all',
				plan: plan(1),
				execute: async () => deleted,
				refresh,
				getPlan: () => plan(1)
			})
		).resolves.toEqual({ kind: 'deleted', result: deleted });
		expect(refresh).not.toHaveBeenCalled();
	});
	it('returns repository refusals', async () => {
		const refusal: DeleteResult = { ok: false, reason: 'not_found' };
		await expect(
			deleteCommand({
				id: 'root',
				mode: 'only',
				plan: plan(0),
				execute: async () => refusal,
				refresh: vi.fn(),
				getPlan: () => plan(0)
			})
		).resolves.toEqual({ kind: 'refused', result: refusal });
	});
	it('refreshes and requests confirmation for a changed nonempty plan', async () => {
		const refresh = vi.fn();
		await expect(
			deleteCommand({
				id: 'root',
				mode: 'all',
				plan: plan(1),
				execute: async () => changed,
				refresh,
				getPlan: () => plan(2)
			})
		).resolves.toEqual({ kind: 'confirm', plan: plan(2) });
		expect(refresh).toHaveBeenCalledOnce();
	});
	it('deletes immediately after refresh when the changed plan has no descendants', async () => {
		const execute = vi.fn().mockResolvedValueOnce(changed).mockResolvedValueOnce(deleted);
		await expect(
			deleteCommand({
				id: 'root',
				mode: 'all',
				plan: plan(1),
				execute,
				refresh: vi.fn(),
				getPlan: () => plan(0)
			})
		).resolves.toEqual({ kind: 'deleted', result: deleted });
		expect(execute).toHaveBeenNthCalledWith(2, 'all', plan(0));
	});
	it('stops after a second plan change', async () => {
		const execute = vi.fn().mockResolvedValue(changed);
		await expect(
			deleteCommand({
				id: 'root',
				mode: 'all',
				plan: plan(1),
				retries: 1,
				execute,
				refresh: vi.fn(),
				getPlan: () => plan(0)
			})
		).resolves.toEqual({ kind: 'stopped' });
		expect(execute).toHaveBeenCalledOnce();
	});
	it('reports an execution failure', async () => {
		await expect(
			deleteCommand({
				id: 'root',
				mode: 'all',
				plan: plan(0),
				execute: async () => null,
				refresh: vi.fn(),
				getPlan: () => null
			})
		).resolves.toEqual({ kind: 'failed' });
	});
});

describe('initial delete choice', () => {
	it('deletes directly when there are no descendants, including a shared-only plan', async () => {
		const { deleteChoiceForPlan } = await import('./deleteCommand');
		expect(deleteChoiceForPlan(plan(0))).toBe('delete');
		expect(
			deleteChoiceForPlan({ ...plan(0), keptShared: [{ id: 'shared', otherParentIds: ['live'] }] })
		).toBe('delete');
	});
	it('asks for confirmation when one or more descendants will be deleted', async () => {
		const { deleteChoiceForPlan } = await import('./deleteCommand');
		expect(deleteChoiceForPlan(plan(1))).toBe('confirm');
		expect(deleteChoiceForPlan(plan(5))).toBe('confirm');
	});
});

describe('all typed repository refusals', () => {
	it.each(['not_found', 'not_intention', 'already_deleted'] as const)(
		'returns %s without refresh',
		async (reason) => {
			const refusal: DeleteResult = { ok: false, reason };
			const refresh = vi.fn();
			await expect(
				deleteCommand({
					id: 'root',
					mode: 'all',
					plan: plan(1),
					execute: async () => refusal,
					refresh,
					getPlan: () => plan(1)
				})
			).resolves.toEqual({ kind: 'refused', result: refusal });
			expect(refresh).not.toHaveBeenCalled();
		}
	);
});

describe('localized undo labels', () => {
	it('uses Russian and English plurals for 1, 2, 5 and 21 deleted descendants', async () => {
		const { locale } = await import('$lib/state/Locale/Locale.svelte');
		const { deleteToast } = await import('./deleteCommand');
		const expected = {
			ru: [
				'Удалено: задача и 1 подзадача',
				'Удалено: задача и 2 подзадачи',
				'Удалено: задача и 5 подзадач',
				'Удалено: задача и 21 подзадача'
			],
			en: [
				'Deleted: task and 1 subtask',
				'Deleted: task and 2 subtasks',
				'Deleted: task and 5 subtasks',
				'Deleted: task and 21 subtasks'
			]
		};
		for (const language of ['ru', 'en'] as const) {
			locale.set(language);
			expect([1, 2, 5, 21].map((count) => deleteToast('all', 'Root', plan(count)))).toEqual(
				expected[language]
			);
		}
		locale.set('ru');
	});
	it('keeps the selected title in singular and only-task labels in both locales', async () => {
		const { locale } = await import('$lib/state/Locale/Locale.svelte');
		const { deleteToast } = await import('./deleteCommand');
		for (const language of ['ru', 'en'] as const) {
			locale.set(language);
			expect(deleteToast('all', 'Root', plan(0))).toBe(
				language === 'ru' ? 'Удалено: «Root»' : 'Deleted: “Root”'
			);
			expect(deleteToast('only', 'Root', plan(3))).toBe(
				language === 'ru'
					? 'Удалено: «Root». Подзадачи остались'
					: 'Deleted: “Root”. Subtasks remain'
			);
		}
		locale.set('ru');
	});
});

describe('deleteIntentionWithUndo repository boundary', () => {
	beforeEach(() => {
		vi.mocked(tempienceRepository.deleteIntention).mockReset();
		vi.mocked(tempienceRepository.undoOperation).mockReset();
	});
	const makeOptions = (mode: 'all' | 'only', planValue = plan(2)) => {
		const undo = { offer: vi.fn() } as unknown as UndoState;
		const refresh = vi.fn(async () => {});
		const failure = vi.fn();
		const close = vi.fn();
		return {
			options: { id: 'root', title: 'Root', mode, plan: planValue, undo, refresh, failure, close },
			undo,
			refresh,
			failure,
			close
		};
	};

	it('passes the exact expected plan, offers undo, closes and refreshes after deleting all', async () => {
		locale.set('ru');
		vi.mocked(tempienceRepository.deleteIntention).mockResolvedValue({
			ok: true,
			operationId: 'op',
			deletedIds: ['root', 'child-0', 'child-1']
		});
		const state = makeOptions('all');
		await expect(deleteIntentionWithUndo(state.options)).resolves.toMatchObject({
			ok: true,
			operationId: 'op'
		});
		expect(tempienceRepository.deleteIntention).toHaveBeenCalledWith('root', 'all', {
			expectedDeleteIds: ['root', 'child-0', 'child-1']
		});
		expect(state.undo.offer).toHaveBeenCalledOnce();
		const offer = vi.mocked(state.undo.offer).mock.calls[0][0];
		expect(typeof offer.label === 'function' ? offer.label() : offer.label).toBe(
			'Удалено: задача и 2 подзадачи'
		);
		await offer.invert();
		expect(tempienceRepository.undoOperation).toHaveBeenCalledWith('op', 'user');
		expect(state.close).toHaveBeenCalledOnce();
		expect(state.refresh).toHaveBeenCalledOnce();
		expect(state.failure).toHaveBeenCalledWith('');
	});

	it('deletes only the selected task without passing expectedDeleteIds', async () => {
		vi.mocked(tempienceRepository.deleteIntention).mockResolvedValue({
			ok: true,
			operationId: 'op-only',
			deletedIds: ['root']
		});
		const state = makeOptions('only');
		await deleteIntentionWithUndo(state.options);
		expect(tempienceRepository.deleteIntention).toHaveBeenCalledWith('root', 'only');
		const offer = vi.mocked(state.undo.offer).mock.calls[0][0];
		expect(typeof offer.label === 'function' ? offer.label() : offer.label).toBe(
			'Удалено: «Root». Подзадачи остались'
		);
	});

	it.each([
		['not_found', 'Запись не найдена.'],
		['not_intention', 'Это не намерение.'],
		['already_deleted', 'Задача уже удалена.']
	] as const)('routes %s through the localized failure channel', async (reason, message) => {
		locale.set('ru');
		vi.mocked(tempienceRepository.deleteIntention).mockResolvedValue({ ok: false, reason });
		const state = makeOptions('all');
		await expect(deleteIntentionWithUndo(state.options)).resolves.toEqual({ ok: false, reason });
		expect(state.failure).toHaveBeenCalledWith(message);
		expect(state.undo.offer).not.toHaveBeenCalled();
		expect(state.close).not.toHaveBeenCalled();
		expect(state.refresh).not.toHaveBeenCalled();
	});
});
