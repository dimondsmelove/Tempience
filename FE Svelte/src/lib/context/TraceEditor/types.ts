import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
import type { OpenSaved } from '$lib/state/TraceDraft/types';

export type { TemporalPlacement, TimeDraft } from '$lib/state/TraceDraft/types';

export type TraceEditorProps = {
	/** The one open form this editor renders; the entry point created and loads it. */
	draft: TraceDraftState;
	/** Opens the committed record; a rejection means «saved, but not opened» with a retry. */
	onopen: OpenSaved;
	/** The exit the entry point wants; it passes the discard question when the form changed. */
	oncancel: () => void;
	/**
	 * A requirement of the entry point that is not part of the record's own checks (for example
	 * a surface that needs exactly one of its activities); while set, saving is blocked with it.
	 */
	saveBlock?: string | null;
};
/**
 * Where a new record stands: an event that happened, an intention, or an event stated as an
 * intention's result. The third is interface only: in the data it is a fact plus evidence_for.
 */
export type RecordMode = 'actual' | 'intend' | 'evidence';

export const PRECISIONS = [
	{ value: 'day', label: 'time.day' },
	{ value: 'minute', label: 'time.dateTime' },
	{ value: 'month', label: 'time.month' },
	{ value: 'year', label: 'time.year' }
] as const;
