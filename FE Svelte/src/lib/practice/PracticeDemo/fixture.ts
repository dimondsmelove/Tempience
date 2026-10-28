import { DEMO_ACTIVITIES, DEMO_BASE_SCOPE, DEMO_KIND_ID, DEMO_START } from './constants';
import { addDays } from './model';
import type { PracticeEntry } from './types';

const weeklyRatios = [0.48, 0.72, 0.64, 0.91, 0.83, 1.08, 0.96];
const dayWeights = [0.18, 0.16, 0.2, 0.16, 0.18, 0.08, 0.04];
const currentWeek = [
	[180, 180, 120],
	[45, 60, 0],
	[0, 60, 30],
	[15, 0, 30],
	[30, 30, 15],
	[45, 45, 45]
];

/** In-memory typed-record fixtures. Nothing is seeded into a repository or browser storage. */
export const demoEntries = (): readonly PracticeEntry[] => {
	const entries: PracticeEntry[] = [];
	for (let week = 0; week < 8; week++) {
		for (const [activityIndex, activity] of DEMO_ACTIVITIES.entries()) {
			for (let day = 0; day < (week === 7 ? 3 : 7); day++) {
				const minutes =
					week === 7
						? currentWeek[activityIndex][day]
						: Math.round((activity.weeklyMinutes * weeklyRatios[week] * dayWeights[day]) / 15) * 15;
				if (!minutes) continue;
				entries.push({
					id: `practice-${week}-${activity.id}-${day}`,
					kindId: DEMO_KIND_ID,
					scopeIds: [DEMO_BASE_SCOPE, activity.id],
					date: addDays(DEMO_START, week * 7 + day),
					hour: 9 + activityIndex * 2,
					data: { minutes },
					note: activity.note
				});
			}
		}
	}
	return entries;
};
