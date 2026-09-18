import type { PeriodRef } from '$lib/model/Axis/types';
import type { MarkTime } from '$lib/model/Projection/types';
import type { ExplorerPeriod } from '$lib/model/Snapshot/types';

export type PeriodTrace = Readonly<{
	traceId: string;
	label: string;
	time: MarkTime;
}>;

/** Records of the period under one Scope; `scopeId` is null for records without a Scope. */
export type PeriodScopeGroup = Readonly<{
	scopeId: string | null;
	name: string;
	traces: readonly PeriodTrace[];
}>;

/** Neighbouring calendar periods: same unit around, one unit up, the units inside. */
export type PeriodNeighbors = Readonly<{
	previous: PeriodRef;
	next: PeriodRef;
	parent: PeriodRef | null;
	children: readonly PeriodRef[];
}>;

export type PeriodContext = Readonly<{
	period: PeriodRef;
	title: string;
	/** The persisted Period whose bounds match the calendar period, if one exists. */
	record: ExplorerPeriod | null;
	note: string | null;
	groups: readonly PeriodScopeGroup[];
	/** Distinct records inside the period. */
	traceCount: number;
	activeScopeIds: readonly string[];
	neighbors: PeriodNeighbors;
}>;
