import { and, gte, isNull, lt, or } from "drizzle-orm";
import { db } from "../../db/client";
import { traces } from "../../db/schema";
import { weekStartISO as apiWeekStartISO } from "../week";

export const fetchTraceWeekWeights = async (
	rangeFrom: string,
	rangeTo: string
): Promise<Map<string, number>> => {
	const rows = await db
		.select({
			aboutStart: traces.aboutStart,
			capturedAt: traces.capturedAt
		})
		.from(traces)
		.where(
			and(
				isNull(traces.retractedAt),
				or(
					and(gte(traces.capturedAt, rangeFrom), lt(traces.capturedAt, rangeTo)),
					and(gte(traces.aboutStart, rangeFrom), lt(traces.aboutStart, rangeTo))
				)
			)
		);

	const weights = new Map<string, number>();
	for (const row of rows) {
		const anchor = row.aboutStart ?? row.capturedAt;
		if (!anchor) continue;
		const week = apiWeekStartISO(anchor.slice(0, 10));
		weights.set(week, (weights.get(week) ?? 0) + 1);
	}

	return weights;
};
