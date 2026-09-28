import type { NoteEditing } from './NoteEditing.svelte';

export type ContextNoteProps = Readonly<{
	/** The note as it stands. */
	text: string | null;
	/** Written in place: the editing state and its words; absent where the note is edited elsewhere. */
	editor?: NoteEditing;
	labels?: Readonly<{ note: string; save: string; edit: string }>;
	/** The block's own test id, and its text's. */
	testId?: string;
	textTestId?: string;
}>;
