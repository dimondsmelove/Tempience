import { describe, expect, it, vi } from 'vitest';
import { NoteEditing } from './NoteEditing.svelte';

describe('a note written in place', () => {
	it('opens a draft from the note, saves it trimmed, and says it was saved', async () => {
		let note: string | null = 'Старое';
		const write = vi.fn(async (next: string | null) => void (note = next));
		const editor = new NoteEditing(() => note, write, 'period.noteSaved');
		editor.edit();
		expect(editor).toMatchObject({ editing: true, draft: 'Старое' });
		editor.draft = '  Новое  ';
		await editor.save();
		expect(write).toHaveBeenCalledWith('Новое');
		expect(editor).toMatchObject({ editing: false, busy: false, notice: 'period.noteSaved' });
		editor.edit();
		editor.draft = '   ';
		await editor.save();
		expect(note).toBeNull();
	});
	it('keeps the draft open with the cause when the save fails, and drops it on cancel', async () => {
		const cause = new Error('refused');
		const editor = new NoteEditing(
			() => null,
			async () => {
				throw cause;
			}
		);
		editor.edit();
		editor.draft = 'Текст';
		await editor.save();
		expect(editor).toMatchObject({ editing: true, busy: false, failure: cause, notice: null });
		editor.cancel();
		expect(editor.editing).toBe(false);
	});
});
