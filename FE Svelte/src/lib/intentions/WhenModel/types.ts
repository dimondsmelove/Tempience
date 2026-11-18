import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import type { MoveResult } from '../MoveIntention/types';

export type WhenChoice =
	| { kind: 'today' }
	| { kind: 'tomorrow' }
	| { kind: 'week' }
	| { kind: 'undated' }
	| { kind: 'day'; dayKey: string }
	| { kind: 'time'; hours: number; minutes: number }
	| { kind: 'clearTime' };

export type WhenContext = { zone: string; now: number; weekStart: number };
export type WhenResult = MoveResult | { ok: false; reason: 'needs_day' | 'needs_full' };
export type WhenViewPlacement = 'day' | 'week' | 'undated' | 'inexact';
export type WhenView = {
	placement: WhenViewPlacement;
	weekStart: string | null;
	dayKey: string | null;
	time: { hours: number; minutes: number } | null;
	canSetTime: boolean;
	canClearTime: boolean;
	isExact: boolean;
};
export type WhenTrace = Pick<ExplorerTrace, 'aboutKind' | 'aboutTime' | 'statedDuration'>;
