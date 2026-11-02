import type { PracticeDirection, PracticePeriod } from '../../model/Practice/types';
export type PracticeDirectionsProps = {
	rows: readonly (PracticeDirection & Readonly<{ unplannedMinutes?: number }>)[];
	period: PracticePeriod;
	activityId: string | null;
	onselect: (id: string) => void;
};
