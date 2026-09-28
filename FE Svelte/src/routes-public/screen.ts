export type PublicScreen = 'reading' | 'tour' | 'firstScope' | 'workbench';

export type PublicScreenInput = Readonly<{
	/** The persisted records have been read: nothing is decided before that. */
	ready: boolean;
	/** The own space holds neither a record nor a Scope. */
	empty: boolean;
	/** `tempience.onboarding.completed`: the tour has been seen. */
	completed: boolean;
	/** «Начать без Scope» was pressed in this session. */
	skipped: boolean;
}>;

/**
 * Which screen the public app shows. An empty own space goes to the tour once, then to the
 * first Scope. «Начать без Scope» opens the workbench at once — with the capture form, which
 * is what the press asked for — and only for this session: on a reload with the space still
 * empty the first-Scope screen returns (accepted rule of loop 007).
 */
export const publicScreen = ({
	ready,
	empty,
	completed,
	skipped
}: PublicScreenInput): PublicScreen => {
	if (!ready) return 'reading';
	if (!empty) return 'workbench';
	if (!completed) return 'tour';
	return skipped ? 'workbench' : 'firstScope';
};
