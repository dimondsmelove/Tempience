import { CodedError } from '$lib/model/Errors/CodedError';
import type { TempienceTriplitClient } from '../client';
import { createId } from '../ids';
import { assertStorageSchemaReady } from '../Repository/readiness';
import { fetchReplica } from '../replica-fetch';
import { currentWeek, parsePracticeTarget, validWeeklyMinutes } from './targets';
import type { PracticeTarget, PracticeTargetInput } from './types';

export type PracticeTargetsOptions = { now?: () => Date; timezone?: () => string };

const parseRows = (rows: readonly unknown[]): PracticeTarget[] => rows.map(parsePracticeTarget);

export const createPracticeTargetsRepository = (
	client: TempienceTriplitClient,
	options: PracticeTargetsOptions = {}
) => {
	const now = options.now ?? (() => new Date());
	const timezone = options.timezone ?? (() => Intl.DateTimeFormat().resolvedOptions().timeZone);
	return {
		async listPracticeTargets(): Promise<PracticeTarget[]> {
			await assertStorageSchemaReady(client);
			return parseRows(await fetchReplica(client, client.query('practiceTargets')));
		},
		subscribePracticeTargets(
			next: (rows: PracticeTarget[]) => void,
			fail: (cause: unknown) => void
		): () => void {
			let disposed = false;
			let stop = () => {};
			void assertStorageSchemaReady(client)
				.then(() => {
					if (disposed) return;
					stop = client.subscribe(
						client.query('practiceTargets'),
						(rows) => {
							if (disposed) return;
							try {
								next(parseRows(rows));
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
		/** Appends a budget for the current local week on; earlier weeks keep their statements. */
		async setWeeklyTarget(input: PracticeTargetInput): Promise<PracticeTarget> {
			if (!validWeeklyMinutes(input.minutesPerWeek))
				throw new CodedError('practice_target_value', 'Enter whole minutes per week');
			await assertStorageSchemaReady(client);
			const at = now();
			const row: PracticeTarget = {
				id: createId(),
				sourceId: 'source',
				scopeId: input.scopeId,
				minutesPerWeek: input.minutesPerWeek,
				effectiveFromWeek: currentWeek(at, timezone()),
				createdAt: at.toISOString(),
				isDeleted: false
			};
			await client.transact(async (tx) => {
				const source = await tx.fetchById('practiceSettings', 'source');
				const scopeIds = (source?.scopeIds ?? []) as string[];
				const scope = await tx.fetchById('scopes', input.scopeId);
				if (!scope || scope.isDeleted || !scopeIds.includes(input.scopeId))
					throw new CodedError('scope_missing', 'Select an existing Scope');
				await tx.insert('practiceTargets', { ...row });
			});
			return row;
		}
	};
};
export type PracticeTargetsRepository = ReturnType<typeof createPracticeTargetsRepository>;
