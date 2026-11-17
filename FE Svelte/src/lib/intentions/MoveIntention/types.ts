import type { TraceAboutKind, TraceAboutTime, TraceDuration } from '$lib/state/triplit/types';

export type MoveTarget =
	{ kind: 'day'; dayKey: string } | { kind: 'week'; weekStart: number } | { kind: 'undated' };
export type MoveFields = {
	aboutKind: TraceAboutKind;
	aboutTime: TraceAboutTime;
	statedDuration: TraceDuration | null;
};
export type MoveResult =
	| { ok: true; fields: MoveFields }
	| { ok: false; reason: 'not_found' | 'not_intention' | 'closed' | 'invalid_target' };

export type MoveSavedResult =
	{ ok: true; fields: MoveFields; operationId: string } | Extract<MoveResult, { ok: false }>;
