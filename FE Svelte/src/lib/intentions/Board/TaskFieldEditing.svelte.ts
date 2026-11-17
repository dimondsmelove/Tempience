import type { TraceRecordFields } from '$lib/state/triplit';

/** A task field's local input, committed through the record command only after validation. */
export class TaskFieldEditing {
	editing = $state(false);
	text = $state('');
	busy = $state(false);
	invalid = $state(false);
	failure = $state.raw<unknown>(null);
	constructor(
		readonly field: 'title' | 'description',
		readonly write: (fields: TraceRecordFields) => Promise<void>
	) {}
	edit(value: string): void {
		this.text = value;
		this.invalid = false;
		this.failure = null;
		this.editing = true;
	}
	cancel(): void {
		this.editing = false;
		this.invalid = false;
		this.failure = null;
	}
	async save(): Promise<boolean> {
		if (this.busy) return false;
		const text = this.text.trim();
		if (this.field === 'title' && !text) {
			this.invalid = true;
			return false;
		}
		this.busy = true;
		this.failure = null;
		try {
			await this.write(this.field === 'title' ? { title: text } : { description: text || null });
			this.editing = false;
			return true;
		} catch (cause) {
			this.failure = cause;
			return false;
		} finally {
			this.busy = false;
		}
	}
}
