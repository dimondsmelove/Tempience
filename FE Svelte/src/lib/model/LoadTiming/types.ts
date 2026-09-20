/** A timed step of the Time surface read path, in the order the steps run. */
/** The steps of the read path; the snapshot's own parts are marked inside it. */
export type LoadStep =
	| 'storage'
	| 'seed'
	/** The wait for the server's rows of the snapshot's collections, bounded (inbound sync). */
	| 'inbound'
	| 'snapshot'
	| 'catalogs'
	| 'records'
	| 'links'
	| 'display';

/** The part of `performance` the timing relies on; null where the platform lacks it. */
export interface LoadTimingClock {
	now(): number;
	mark(name: string): unknown;
	measure(name: string, startMark: string, endMark: string): unknown;
}

/** Durations in milliseconds rounded to 0.1; a step is present once it ended. */
export interface LoadTimingReport extends Partial<Record<LoadStep, number>> {
	/** Milliseconds from navigation start to the moment of the report. */
	sinceNavigation: number;
}
