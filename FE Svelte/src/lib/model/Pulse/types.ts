/**
 * What a Context or history navigation points at (loop 008, C3, «куда смотреть»): a record,
 * a Scope, an explicit link or a merged row (C5: its name flashes, nothing rings); a period
 * is shown by its column and pulses nothing.
 */
export type PulseTarget =
	| Readonly<{ kind: 'trace'; traceId: string }>
	| Readonly<{ kind: 'scope'; scopeId: string }>
	| Readonly<{ kind: 'intersection'; intersectionId: string }>
	| Readonly<{ kind: 'row'; rowId: string }>;

/** One pulse: the selection key it rings, when it started (its identity), and what it points at. */
export type Pulse = Readonly<{ key: string; at: number; target: PulseTarget }>;

/** What the canvas draws for a pulse: the rings around every projection of these records, as one growing ring. */
export type CanvasPulse = Readonly<{ key: string; at: number; traceIds: ReadonlySet<string> }>;
