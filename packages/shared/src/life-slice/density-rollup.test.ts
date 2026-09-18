import { describe, expect, it } from "vitest";
import { buildLifeWeeks } from "./life-weeks";
import { densityStats, rollupWeekWeights, sparseFilledBuckets } from "./density-rollup";
import { weekStartsForIntervals } from "./scope-weeks";

describe("density-rollup", () => {
	const weeks = buildLifeWeeks({
		birthDate: "2026-07-01",
		horizonDate: "2026-08-01",
		currentWeekStart: "2026-07-06",
		fromWeek: "2026-06-29",
		toWeek: "2026-07-13"
	});

	it("rollupWeekWeights week resolution", () => {
		const weights = new Map([
			["2026-06-29", 1],
			["2026-07-06", 2]
		]);
		const buckets = rollupWeekWeights(weeks, weights, "week");
		expect(buckets.find((b) => b.key === "2026-07-06")?.weight).toBe(2);
		expect(buckets.find((b) => b.key === "2026-07-13")?.filled).toBe(false);
	});

	it("sparseFilledBuckets keeps only filled", () => {
		const buckets = [
			{ key: "a", filled: true, weight: 1 },
			{ key: "b", filled: false, weight: 0 }
		];
		expect(sparseFilledBuckets(buckets)).toHaveLength(1);
		expect(densityStats(buckets).filled_buckets).toBe(1);
	});
});

describe("scope-weeks", () => {
	it("weekStartsForIntervals respects bounds", () => {
		const weeks = weekStartsForIntervals(
			[{ start_at: "2026-07-01T00:00:00.000Z", end_at: "2026-07-20T00:00:00.000Z" }],
			{ fromWeek: "2026-06-29", toWeek: "2026-07-13", horizonDate: "2026-08-01" }
		);
		expect([...weeks]).toEqual(["2026-06-29", "2026-07-06", "2026-07-13"]);
	});
});

describe("scope-weeks future clip", () => {
	it("open-ended scope stops at current week by default", () => {
		const weeks = weekStartsForIntervals(
			[{ start_at: "2020-01-01T00:00:00.000Z", end_at: null }],
			{
				fromWeek: "2020-01-01",
				toWeek: "2030-12-31",
				horizonDate: "2095-03-28",
				currentWeekStart: "2026-07-07"
			}
		);
		expect(weeks.size).toBeGreaterThan(0);
		expect([...weeks].every((week) => week <= "2026-07-07")).toBe(true);
		const maxWeek = [...weeks].sort().at(-1)!;
		expect(maxWeek <= "2026-07-07").toBe(true);
		expect(weeks.has("2026-07-14")).toBe(false);
	});

	it("scope_include_future extends through horizon", () => {
		const weeks = weekStartsForIntervals(
			[{ start_at: "2026-07-01T00:00:00.000Z", end_at: null }],
			{
				fromWeek: "2026-06-29",
				toWeek: "2026-07-27",
				horizonDate: "2026-08-01",
				currentWeekStart: "2026-07-07",
				includeFutureScope: true
			}
		);
		expect(weeks.has("2026-07-20")).toBe(true);
	});
});
