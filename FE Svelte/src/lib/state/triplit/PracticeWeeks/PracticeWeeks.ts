import { CodedError } from '$lib/model/Errors/CodedError';
import type { TempienceTriplitClient } from '../client';
import { assertStorageSchemaReady } from '../Repository/readiness';
import { fetchReplica } from '../replica-fetch';
import { parsePracticeWeekPlan } from './plans';
import type { PracticeWeekPlan, PracticeWeekPlanInput } from './types';

export const createPracticeWeekPlansRepository = (
	client: TempienceTriplitClient,
	now: () => Date = () => new Date()
) => {
	const listPracticeWeekPlans = async (): Promise<PracticeWeekPlan[]> => {
		await assertStorageSchemaReady(client);
		const rows = await fetchReplica(client, client.query('practiceWeekPlans'));
		return rows.map(parsePracticeWeekPlan).toSorted((a, b) => a.week.localeCompare(b.week));
	};
	return {
		listPracticeWeekPlans,
		async getPracticeWeekPlan(week: string): Promise<PracticeWeekPlan | null> {
			await assertStorageSchemaReady(client);
			const rows = await fetchReplica(
				client,
				client.query('practiceWeekPlans').Where('id', '=', week)
			);
			return rows[0] ? parsePracticeWeekPlan(rows[0]) : null;
		},
		subscribePracticeWeekPlans(
			next: (plans: PracticeWeekPlan[]) => void,
			fail: (cause: unknown) => void
		): () => void {
			let disposed = false;
			let stop = () => {};
			void assertStorageSchemaReady(client)
				.then(() => {
					if (disposed) return;
					stop = client.subscribe(
						client.query('practiceWeekPlans'),
						(rows) => {
							if (disposed) return;
							try {
								const plans = rows
									.map(parsePracticeWeekPlan)
									.toSorted((a, b) => a.week.localeCompare(b.week));
								next(plans);
							} catch (cause) {
								fail(cause);
							}
						},
						fail
					);
				})
				.catch((cause) => {
					if (!disposed) fail(cause);
				});
			return () => {
				disposed = true;
				stop();
			};
		},
		async savePracticeWeekPlan(
			week: string,
			input: PracticeWeekPlanInput
		): Promise<PracticeWeekPlan> {
			const at = now();
			await assertStorageSchemaReady(client);
			let saved: PracticeWeekPlan | null = null;
			await client.transact(async (tx) => {
				const existing = await tx.fetchById('practiceWeekPlans', week);
				const current = existing ? parsePracticeWeekPlan(existing) : null;
				const selected = [...input.scopeIds];
				const goals = input.goals
					? { ...input.goals }
					: Object.fromEntries(
							Object.entries(current?.goals ?? {}).filter(([scopeId]) => selected.includes(scopeId))
						);
				const row = parsePracticeWeekPlan({
					id: week,
					scopeIds: selected,
					goals,
					updatedAt: at.toISOString()
				});
				for (const scopeId of row.scopeIds) {
					const scope = await tx.fetchById('scopes', scopeId);
					if (!scope || (scope.isDeleted && !current?.scopeIds.includes(scopeId)))
						throw new CodedError('scope_missing', 'Select an existing Scope');
				}
				if (existing) {
					await tx.update('practiceWeekPlans', week, (current) => {
						current.scopeIds = [...row.scopeIds];
						current.goals = { ...row.goals };
						current.updatedAt = row.updatedAt;
					});
				} else {
					await tx.insert('practiceWeekPlans', {
						id: week,
						scopeIds: [...row.scopeIds],
						goals: { ...row.goals },
						updatedAt: row.updatedAt
					});
				}
				saved = row;
			});
			return saved!;
		}
	};
};

export type PracticeWeekPlansRepository = ReturnType<typeof createPracticeWeekPlansRepository>;
