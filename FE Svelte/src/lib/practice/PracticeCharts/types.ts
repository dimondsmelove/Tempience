import type { PracticeBucket, PracticePeriod, PracticeChartActivity } from '../PracticeDemo/types';

export type PracticeChartsProps = {
	buckets: readonly PracticeBucket[];
	history: readonly PracticeBucket[];
	period: PracticePeriod;
	weeklyMinutes: number | null;
	selection: string;
	today: string;
	activities: readonly PracticeChartActivity[];
	onday: (date: string) => void;
	onweek: (date: string) => void;
};
