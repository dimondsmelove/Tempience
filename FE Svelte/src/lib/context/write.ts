/** What a command did, told apart from what showing its result did. */
export type WriteOutcome = Readonly<{
	/** Whether the repository accepted the command. */
	written: boolean;
	/** What it was refused with, or null; the words are read where it is shown. */
	refusal: unknown;
	/** What showing the result failed with, although the command was accepted; or null. */
	readFailure: unknown;
}>;

import { contextWork } from './pending';

/**
 * One command of the Context and the reading that follows it. A refused command changes
 * nothing and says why; an accepted one stays accepted even when the views that should show
 * it cannot be read, so the only thing offered again is the reading — never the write.
 */
export const writeThenRead = (
	write: () => Promise<void>,
	read: () => Promise<void>,
	/** Runs the moment the command is accepted, before anything is read again. */
	onCommitted?: () => void
): Promise<WriteOutcome> =>
	// One command of the Context at a time is the app's pending work; an exit waits for it.
	contextWork.hold(runCommand(write, read, onCommitted));

const runCommand = async (
	write: () => Promise<void>,
	read: () => Promise<void>,
	onCommitted?: () => void
): Promise<WriteOutcome> => {
	try {
		await write();
	} catch (cause) {
		return { written: false, refusal: cause ?? new Error(), readFailure: null };
	}
	onCommitted?.();
	try {
		await read();
	} catch (cause) {
		return { written: true, refusal: null, readFailure: cause ?? new Error() };
	}
	return { written: true, refusal: null, readFailure: null };
};
