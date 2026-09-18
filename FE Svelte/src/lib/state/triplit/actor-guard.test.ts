import { describe, expect, it, vi } from 'vitest';
import { AI_WRITE_MESSAGE, guardAiWrites } from './actor-guard';

describe('guardAiWrites', () => {
	const inner = {
		createTrace: vi.fn(async (draft: { content: string }, actor = 'user') => ({ ...draft, actor })),
		setTraceDeleted: vi.fn(async (id: string, isDeleted: boolean, actor = 'user') => ({
			id,
			isDeleted,
			actor
		})),
		saveTraceRecord: vi.fn(async (save: { fields: object }, actor = 'user') => ({
			...save,
			actor
		})),
		undoOperation: vi.fn(async (operationId: string, actor = 'user') => ({ operationId, actor })),
		listTraces: vi.fn(async (actor?: string) => [actor])
	};
	const repository = guardAiWrites(inner);

	it('refuses mutations made as the AI and keeps user and system writes', async () => {
		expect(() => repository.createTrace({ content: 'x' }, 'ai')).toThrow(AI_WRITE_MESSAGE);
		expect(() => repository.setTraceDeleted('t', true, 'ai')).toThrow(AI_WRITE_MESSAGE);
		expect(() => repository.saveTraceRecord({ fields: {} }, 'ai')).toThrow(AI_WRITE_MESSAGE);
		expect(() => repository.undoOperation('op', 'ai')).toThrow(AI_WRITE_MESSAGE);
		expect(inner.createTrace).not.toHaveBeenCalled();
		expect(inner.saveTraceRecord).not.toHaveBeenCalled();
		expect(inner.undoOperation).not.toHaveBeenCalled();
		await expect(repository.createTrace({ content: 'x' })).resolves.toMatchObject({
			actor: 'user'
		});
		await expect(repository.setTraceDeleted('t', true, 'system')).resolves.toMatchObject({
			actor: 'system'
		});
		await expect(repository.saveTraceRecord({ fields: {} })).resolves.toMatchObject({
			actor: 'user'
		});
	});

	it('leaves reads alone even when their argument happens to be "ai"', async () => {
		await expect(repository.listTraces('ai')).resolves.toEqual(['ai']);
	});
});
