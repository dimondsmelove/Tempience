/**
 * A refusal with a stable code and the facts the user has to act on. The message is what a
 * developer reads in a log or a test; what the user reads is the interface's own copy for
 * the code, in the current language, with `details` as its parameters — see
 * `state/Locale/errors.ts`. A `reason` in the details selects a variant of that copy.
 */
export class CodedError<Code extends string = string> extends Error {
	constructor(
		readonly code: Code,
		message: string,
		readonly details: Record<string, unknown> = {}
	) {
		super(message);
		this.name = 'CodedError';
	}
}
