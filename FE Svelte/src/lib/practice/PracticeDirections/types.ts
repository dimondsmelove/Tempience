import type { PracticeDirection, PracticePeriod } from '../PracticeDemo/types';
export type PracticeDirectionsProps = {
	rows: readonly PracticeDirection[];
	period: PracticePeriod;
	activityId: string | null;
	onselect: (id: string) => void;
};
