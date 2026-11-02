/** A week's complete practice plan; goals are stored only for selected Scopes with a goal. */
export type PracticeWeekPlan = Readonly<{
	week: string;
	scopeIds: readonly string[];
	goals: Readonly<Record<string, number>>;
	updatedAt: string;
}>;

/** Omitted goals preserve existing goals for still-selected Scopes; `{}` clears all goals. */
export type PracticeWeekPlanInput = Readonly<{
	scopeIds: readonly string[];
	goals?: Readonly<Record<string, number>>;
}>;
