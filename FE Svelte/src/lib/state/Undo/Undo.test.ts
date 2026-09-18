import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSpaceId } from '$lib/state/triplit/data-space';
import { UndoState } from './Undo.svelte';

const HERE = 'canonical' as DataSpaceId;
const THERE = 'imported:backup' as DataSpaceId;

/** The owner as the app wires it: it knows which space is open. */
const spaceAware = (space: DataSpaceId): UndoState => {
	const undo = new UndoState(1000);
	undo.space = () => space;
	return undo;
};

const offer = (
	patch: Partial<{ invert: () => Promise<void>; read: () => Promise<void>; label: string }> = {}
) => ({
	label: patch.label ?? 'Удалено',
	space: HERE,
	invert: patch.invert ?? (async () => {}),
	read: patch.read ?? (async () => {})
});

describe('UndoState', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('keeps one offer for the ttl and takes the action back on undo', async () => {
		const undo = spaceAware(HERE);
		const invert = vi.fn(async () => {});
		undo.offer(offer({ invert }));
		expect(undo.pending?.label).toBe('Удалено');
		await undo.undo();
		expect(invert).toHaveBeenCalledTimes(1);
		expect(undo.pending).toBeNull();
	});

	it('expires silently and a new offer replaces the old one', () => {
		const undo = spaceAware(HERE);
		undo.offer(offer({ label: 'a' }));
		undo.offer(offer({ label: 'b' }));
		expect(undo.pending?.label).toBe('b');
		vi.advanceTimersByTime(1000);
		expect(undo.pending).toBeNull();
	});

	it('keeps the offer with its reason when the inverse refuses, and tries the inverse again', async () => {
		const undo = spaceAware(HERE);
		let refuse = true;
		const invert = vi.fn(async () => {
			if (refuse) throw new Error('Действие уже отменено.');
		});
		undo.offer(offer({ invert }));
		await undo.undo();
		// Refusing changes nothing, so the offer stays, says why, and is not yet inverted.
		expect([undo.pending?.label, undo.inverted, (undo.failure as Error).message]).toEqual([
			'Удалено',
			false,
			'Действие уже отменено.'
		]);
		refuse = false;
		await undo.undo();
		expect(invert).toHaveBeenCalledTimes(2);
		expect(undo.pending).toBeNull();
	});

	it('writes the inverse once when the reading after it fails, and then only reads again', async () => {
		const undo = spaceAware(HERE);
		const invert = vi.fn(async () => {});
		let readFails = true;
		const read = vi.fn(async () => {
			if (readFails) throw new Error('Снимок недоступен.');
		});
		undo.offer(offer({ invert, read }));
		await undo.undo();
		// The action is taken back for good; what is left is showing it.
		expect(undo.inverted).toBe(true);
		expect((undo.failure as Error).message).toBe('Снимок недоступен.');
		expect(undo.pending?.label).toBe('Удалено');
		await undo.undo();
		expect(invert).toHaveBeenCalledTimes(1);
		expect(read).toHaveBeenCalledTimes(2);
		expect((undo.failure as Error).message).toBe('Снимок недоступен.');
		readFails = false;
		await undo.undo();
		// Still one inverse, and the offer is done once its result could be shown.
		expect(invert).toHaveBeenCalledTimes(1);
		expect([undo.pending, undo.inverted, undo.failure]).toEqual([null, false, null]);
	});

	it('lets a committed inverse be dismissed without writing anything else', async () => {
		const undo = spaceAware(HERE);
		const invert = vi.fn(async () => {});
		undo.offer(offer({ invert, read: async () => Promise.reject(new Error('нет')) }));
		await undo.undo();
		expect(undo.inverted).toBe(true);
		undo.dismiss();
		expect([undo.pending, undo.inverted, undo.failure]).toEqual([null, false, null]);
		expect(invert).toHaveBeenCalledTimes(1);
	});

	it('runs one step at a time, whatever the toast is pressed', async () => {
		const undo = spaceAware(HERE);
		let release = (): void => {};
		const running = new Promise<void>((resolve) => {
			release = resolve;
		});
		const invert = vi.fn(() => running);
		undo.offer(offer({ invert }));
		const first = undo.undo();
		expect(undo.busy).toBe(true);
		await undo.undo();
		undo.offer(offer({ label: 'Другое' }));
		undo.dismiss();
		expect([undo.pending?.label, undo.busy]).toEqual(['Удалено', true]);
		release();
		await first;
		expect(invert).toHaveBeenCalledTimes(1);
		expect(undo.pending).toBeNull();
	});

	it('never acts on an offer made in another space', async () => {
		const undo = spaceAware(HERE);
		const invert = vi.fn(async () => {});
		undo.offer({ ...offer({ invert }), space: THERE, label: 'Удалено там' });
		await undo.undo();
		expect(invert).not.toHaveBeenCalled();
		expect(undo.pending).toBeNull();
		expect(undo.failure).toBe('space');
	});
});
