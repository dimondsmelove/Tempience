import type { PracticeBucket, PracticeChartActivity } from '../PracticeDemo/types';

export type PracticeTooltipProps = {
	triggerId: string;
	bucket: PracticeBucket;
	activities: readonly PracticeChartActivity[];
	label: string;
	weeklyMinutes?: number;
	partial?: boolean;
};
