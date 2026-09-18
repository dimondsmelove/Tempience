/**
 * One nested authoring step — a Scope or a Kind saved from inside an open form, or a Kind
 * saved in the catalog. The write commits once and its result is latched the moment the
 * repository returns it; the return (what happens with the committed result) runs after and
 * can be repeated without writing again when it failed. A click during the step does nothing.
 * The owner of the surrounding form is told about every run through `hold`, so its exit rule
 * waits for the write and the return to settle. Once a step completed, the next run is a new
 * step with a new write.
 */
/** Which step failed and with what: the message for a log, the cause for the words shown. */
export type NestedFailure = Readonly<{
	stage: 'write' | 'return';
	message: string;
	cause: unknown;
}>;

export class NestedSave<T> {
	busy = $state(false);
	failure = $state.raw<NestedFailure | null>(null);
	committed = $state.raw<T | null>(null);
	private back: ((result: T) => void | Promise<void>) | null = null;
	private readonly hold: ((run: Promise<void>) => void) | undefined;

	constructor(hold?: (run: Promise<void>) => void) {
		this.hold = hold;
	}

	run(write: () => Promise<T>, back: (result: T) => void | Promise<void>): Promise<void> {
		if (this.busy) return Promise.resolve();
		this.back = back;
		return this.held(this.execute(write));
	}

	/** Repeats only the return of an already committed result; nothing is written again. */
	retry(): Promise<void> {
		if (this.busy || this.committed === null || !this.back) return Promise.resolve();
		return this.held(this.finish());
	}

	private held(run: Promise<void>): Promise<void> {
		this.hold?.(run);
		return run;
	}

	private async execute(write: () => Promise<T>): Promise<void> {
		this.busy = true;
		this.failure = null;
		try {
			if (this.committed === null) this.committed = await write();
		} catch (cause) {
			this.failure = { stage: 'write', message: messageOf(cause), cause: cause ?? new Error() };
			this.busy = false;
			return;
		}
		await this.finish();
	}

	private async finish(): Promise<void> {
		this.busy = true;
		this.failure = null;
		try {
			await this.back!(this.committed!);
			this.committed = null;
			this.back = null;
		} catch (cause) {
			this.failure = { stage: 'return', message: messageOf(cause), cause: cause ?? new Error() };
		} finally {
			this.busy = false;
		}
	}
}

const messageOf = (cause: unknown): string =>
	cause instanceof Error ? cause.message : String(cause);
