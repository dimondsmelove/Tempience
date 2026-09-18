import type { LifeMapProfileResponse } from "@chronograph/shared";
import { resolveLifeMapContext } from "./resolve-life-map-context";

export const buildLifeMapProfile = async (spaceUid: string): Promise<LifeMapProfileResponse> => {
	const ctx = await resolveLifeMapContext({ spaceUid });

	return {
		profile: {
			birth_date: ctx.birthDate,
			horizon_date: ctx.horizonDate,
			life_horizon_years: ctx.lifeHorizonYears,
			timezone: ctx.timezone
		},
		range: {
			from_week_start: ctx.fromWeek,
			to_week_start: ctx.toWeek
		},
		current_week_start: ctx.currentWeekStart
	};
};
