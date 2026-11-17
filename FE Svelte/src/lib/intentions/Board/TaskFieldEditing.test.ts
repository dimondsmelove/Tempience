import { describe, expect, it, vi } from 'vitest';
import { TaskFieldEditing } from './TaskFieldEditing.svelte';

describe('task fields edited in place', () => {
	it('saves only the changed title and rejects a blank title', async () => {
		const write = vi.fn(async () => {});
		const editor = new TaskFieldEditing('title', write);
		editor.edit('Old');
		editor.text = '  ';
		expect(await editor.save()).toBe(false);
		expect(editor.invalid).toBe(true);
		expect(write).not.toHaveBeenCalled();
		editor.text = ' New ';
		expect(await editor.save()).toBe(true);
		expect(write).toHaveBeenCalledWith({ title: 'New' });
		expect(editor.editing).toBe(false);
	});
	it('cancels without writing and saves a cleared description as null', async () => {
		const write = vi.fn(async () => {});
		const editor = new TaskFieldEditing('description', write);
		editor.edit('Original');
		editor.text = 'Discard';
		editor.cancel();
		expect(write).not.toHaveBeenCalled();
		editor.edit('Original');
		editor.text = '  ';
		await editor.save();
		expect(write).toHaveBeenCalledWith({ description: null });
	});
});
