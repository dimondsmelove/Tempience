import type { PracticeActivity, PracticeEntry } from '$lib/practice/PracticeDemo/types';
import type { TempienceRepository } from '$lib/state/triplit/repository';
export type PracticeRepository = Pick<
	TempienceRepository,
	| 'subscribeTraceKinds'
	| 'subscribeTraceKindVersions'
	| 'subscribeScopes'
	| 'subscribeIntersections'
	| 'subscribeKindIndex'
	| 'subscribeTraceHeads'
>;
export type PracticeIssue = Readonly<{
	id: string;
	reason: 'value' | 'time' | 'scope' | 'version';
}>;
export type PracticeProjection = Readonly<{
	entries: readonly PracticeEntry[];
	issues: readonly PracticeIssue[];
}>;
export type PracticeDashboardData = Readonly<{
	entries: readonly PracticeEntry[];
	activities: readonly PracticeActivity[];
	today: string;
	start: string;
	kindId: string;
	sourceName: string;
}>;
