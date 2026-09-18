import {
	buildLifeWeeks,
	resolveLifeMapWeekRange,
	weekRangeUtc
} from "@chronograph/shared";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { spaceProfiles } from "../../db/schema";
import { weekStartISO as apiWeekStartISO } from "../week";
import { LifeMapProfileMissingError } from "./errors";

export type LifeMapContext = {
	birthDate: string;
	horizonDate: string;
	lifeHorizonYears: number;
	timezone: string;
	currentWeekStart: string;
	fromWeek: string;
	toWeek: string;
	rangeFrom: string;
	rangeTo: string;
};

export const resolveLifeMapContext = async (input: {
	spaceUid: string;
	from?: string;
	to?: string;
	now?: string;
}): Promise<LifeMapContext> => {
	const [profileRow] = await db
		.select()
		.from(spaceProfiles)
		.where(eq(spaceProfiles.spaceUid, input.spaceUid));

	if (!profileRow?.birthDate) {
		throw new LifeMapProfileMissingError();
	}

	const nowInstant = input.now ?? new Date().toISOString();
	const currentWeekStart = apiWeekStartISO(nowInstant.slice(0, 10));
	const { fromWeek, toWeek, horizonDate } = resolveLifeMapWeekRange({
		birthDate: profileRow.birthDate,
		lifeHorizonYears: profileRow.lifeHorizonYears,
		from: input.from,
		to: input.to
	});
	const { from: rangeFrom, to: rangeTo } = weekRangeUtc(fromWeek, toWeek);

	return {
		birthDate: profileRow.birthDate,
		horizonDate,
		lifeHorizonYears: profileRow.lifeHorizonYears,
		timezone: profileRow.timezone,
		currentWeekStart,
		fromWeek,
		toWeek,
		rangeFrom,
		rangeTo
	};
};

export const buildWeekCells = (ctx: LifeMapContext) =>
	buildLifeWeeks({
		birthDate: ctx.birthDate,
		horizonDate: ctx.horizonDate,
		currentWeekStart: ctx.currentWeekStart,
		fromWeek: ctx.fromWeek,
		toWeek: ctx.toWeek
	});
