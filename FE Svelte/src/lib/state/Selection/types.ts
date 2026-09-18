import type { PeriodRef } from '$lib/model/Axis/types';
import type { SelectSource } from '$lib/time/TimelineCanvas/types';

export type SelectionTarget =
	| Readonly<{ kind: 'trace'; traceId: string }>
	| Readonly<{ kind: 'scope'; scopeId: string }>
	| Readonly<{ kind: 'intersection'; intersectionId: string }>
	| Readonly<{ kind: 'period-record'; periodId: string }>
	| Readonly<{ kind: 'period'; period: PeriodRef }>;

/** `n / m` of the history header; `n` is null at rest. */
export type SelectionPosition = Readonly<{ n: number | null; m: number }>;

export type { SelectSource };
