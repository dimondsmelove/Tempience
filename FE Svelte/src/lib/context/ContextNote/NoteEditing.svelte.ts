import type { MessageKey } from '$lib/state/Locale/types';

/**
 * A note written in place (the period's pattern, owner 2026-09-20): a draft opened from the
 * note as it is, saved or dropped; while it is written, the rest of the form waits.
 */
export class NoteEditing {
	draft = $state('');
	editing = $state(false);
	busy = $state(false);
	/** What was said after the last try: saved, or the cause it failed with. */
	notice = $state<MessageKey | null>(null);
	failure = $state.raw<unknown>(null);
	readonly #read: () => string | null;
	readonly #write: (note: string | null) => Promise<void>;
	readonly #saved: MessageKey | null;

	constructor(
		read: () => string | null,
		write: (note: string | null) => Promise<void>,
		saved: MessageKey | null = null
	) {
		this.#read = read;
		this.#write = write;
		this.#saved = saved;
	}

	edit(): void {
		this.draft = this.#read() ?? '';
		this.editing = true;
		this.notice = null;
		this.failure = null;
	}

	cancel(): void {
		this.editing = false;
	}

	/** An empty draft is no note. */
	async save(): Promise<void> {
		this.busy = true;
		this.notice = null;
		this.failure = null;
		try {
			await this.#write(this.draft.trim() || null);
			this.editing = false;
			this.notice = this.#saved;
		} catch (cause) {
			this.failure = cause ?? new Error();
		} finally {
			this.busy = false;
		}
	}
}
