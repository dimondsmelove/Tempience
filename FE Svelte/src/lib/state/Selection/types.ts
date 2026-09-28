import type { PeriodRef } from '$lib/model/Axis/types';
import type { StagePick } from '$lib/model/Chapters/types';
import type { SelectSource } from '$lib/time/TimelineCanvas/types';

export type SelectionTarget =
	| Readonly<{ kind: 'trace'; traceId: string }>
	| Readonly<{ kind: 'scope'; scopeId: string }>
	| Readonly<{ kind: 'intersection'; intersectionId: string }>
	| Readonly<{ kind: 'period-record'; periodId: string }>
	| Readonly<{ kind: 'period'; period: PeriodRef }>
	/** A merged row of the rail (loop 008, C5): by its row id, with the lane's members as they were when chosen. */
	| Readonly<{ kind: 'row'; rowId: string; members: readonly string[] }>
	/**
	 * A chapter, or one of its stages (`stage`: a stage id, `'whole'` for the whole chapter, null
	 * for nothing chosen in the strip yet): kept in the history; nothing is lit, revealed or pulsed.
	 */
	| Readonly<{ kind: 'chapter'; chapterId: string; stage: StagePick }>;

/** `n / m` of the history header; `n` is null at rest. */
export type SelectionPosition = Readonly<{ n: number | null; m: number }>;

export type { SelectSource };
