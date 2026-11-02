import type { ScopeColour } from '$lib/theme/scope-colour';

export type PracticePeriod = 'day' | 'week' | 'month';

export type PracticeActivity = Readonly<{
	id: string;
	name: string;
	weeklyMinutes: number | null;
	note: string;
	colour: ScopeColour | null;
}>;

export type PracticeChartActivity = PracticeActivity & Readonly<{ color: string | null }>;

export type PracticeDirection = PracticeChartActivity &
	Readonly<{
		minutes: number;
		sessions: number;
		percent: number;
		share: number;
	}>;

export type PracticeSort = 'original' | 'ascending' | 'descending';

export type PracticeEntry = Readonly<{
	id: string;
	kindId: string;
	scopeIds: readonly string[];
	date: string;
	hour: number | null;
	data: Readonly<{ minutes: number }>;
	note: string;
}>;

export type PracticeRange = Readonly<{ start: string; end: string }>;

export type PracticeBucket = Readonly<{
	id: string;
	date: string;
	hour?: number;
	minutes: number;
	sessions: number;
	slices: readonly Readonly<{ activityId: string; minutes: number; sessions: number }>[];
	/** The weekly goal in force for this bucket's week, when it differs per week (live history). */
	goal?: number | null;
}>;
