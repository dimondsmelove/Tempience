import { expect, it, vi } from 'vitest';
import type { TraceRepository } from '$lib/state/triplit/Repository/types';
import { repeatIntentionWithUndo } from './repeatCommand';

it('uses the supplied board-zone now and pairs the committed repeat with one user undo', async () => {
	const repeatIntention = vi.fn().mockResolvedValue({
		ok: true,
		operationId: 'repeat-op',
		factId: 'fact',
		copyId: 'copy',
		copyDay: '2026-11-20'
	});
	const undoOperation = vi.fn().mockResolvedValue({});
	const repository = { repeatIntention, undoOperation } as unknown as Pick<
		TraceRepository,
		'repeatIntention' | 'undoOperation'
	>;
	const options = { now: 1795140000000, zone: 'Europe/Belgrade' };
	const command = await repeatIntentionWithUndo(
		repository,
		'task-1',
		'completed',
		'',
		'2026-11-20',
		options
	);

	expect(repeatIntention).toHaveBeenCalledWith('task-1', 'completed', '', '2026-11-20', options);
	expect(command.result).toMatchObject({ operationId: 'repeat-op', copyDay: '2026-11-20' });
	expect(command.undo).toBeTypeOf('function');
	await command.undo?.();
	expect(undoOperation).toHaveBeenCalledOnce();
	expect(undoOperation).toHaveBeenCalledWith('repeat-op', 'user');
});

it('does not expose an undo for a refused repeat', async () => {
	const repeatIntention = vi.fn().mockResolvedValue({ ok: false, reason: 'closed' });
	const undoOperation = vi.fn();
	const repository = { repeatIntention, undoOperation } as unknown as Pick<
		TraceRepository,
		'repeatIntention' | 'undoOperation'
	>;
	const command = await repeatIntentionWithUndo(
		repository,
		'task-1',
		'completed',
		'',
		'2026-11-20',
		{ now: 1795140000000, zone: 'Europe/Belgrade' }
	);
	expect(command.result).toEqual({ ok: false, reason: 'closed' });
	expect(command.undo).toBeNull();
	expect(undoOperation).not.toHaveBeenCalled();
});
