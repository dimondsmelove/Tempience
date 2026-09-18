import { describe, expect, it } from "vitest";
import { rollupWeekWeights, sparseFilledBuckets } from "@chronograph/shared";

describe("life-map density helpers", () => {
	it("sparse buckets shrink payload", () => {
		const buckets = rollupWeekWeights(
			[
				{
					week_start: "2026-07-06",
					age_in_weeks: 0,
					year_index: 0,
					week_index_in_year: 0,
					is_current: true,
					is_past: false,
					is_future: false
				}
			],
			new Map([["2026-07-06", 3]]),
			"week"
		);
		const sparse = sparseFilledBuckets(buckets);
		expect(sparse).toHaveLength(1);
		expect(sparse[0]?.weight).toBe(3);
	});
});
