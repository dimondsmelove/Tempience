import { CodedError } from '$lib/model/Errors/CodedError';
import type { TempienceTriplitClient } from '../client';
import { assertStorageSchemaReady } from '../Repository/readiness';
import { fetchReplica } from '../replica-fetch';
import type { TraceKindV } from '../types';
import { parsePracticeSource, practiceFields, samePath } from './source';
import type { PracticeSource } from './types';

export const createPracticeSettingsRepository = (client: TempienceTriplitClient) => ({
	async getPracticeSource(): Promise<PracticeSource | null> {
		await assertStorageSchemaReady(client);
		const rows = await fetchReplica(
			client,
			client.query('practiceSettings').Where('id', '=', 'source')
		);
		return rows[0] ? parsePracticeSource(rows[0]) : null;
	},
	subscribePracticeSource(
		next: (source: PracticeSource | null) => void,
		fail: (cause: unknown) => void
	): () => void {
		let disposed = false;
		let stop = () => {};
		void assertStorageSchemaReady(client)
			.then(() => {
				if (disposed) return;
				stop = client.subscribe(
					client.query('practiceSettings').Where('id', '=', 'source'),
					(rows) => {
						if (disposed) return;
						try {
							next(rows[0] ? parsePracticeSource(rows[0]) : null);
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
	async setPracticeSource(input: PracticeSource): Promise<void> {
		const source = parsePracticeSource(input);
		await assertStorageSchemaReady(client);
		await client.transact(async (tx) => {
			const kind = await tx.fetchById('traceKinds', source.kindId);
			const version = kind ? await tx.fetchById('traceKindVersions', kind.currentKindVId) : null;
			if (
				!kind ||
				kind.isDeleted ||
				!version ||
				!practiceFields(version as TraceKindV).some((field) => samePath(field.path, source.path))
			)
				throw new CodedError(
					'practice_source_field',
					'Select an active Kind and its numeric minutes field'
				);
			for (const id of source.scopeIds) {
				const scope = await tx.fetchById('scopes', id);
				if (!scope || scope.isDeleted)
					throw new CodedError('scope_missing', 'Select an existing Scope');
			}
			const values = {
				kindId: source.kindId,
				path: [...source.path],
				scopeIds: [...source.scopeIds]
			};
			if (await tx.fetchById('practiceSettings', 'source'))
				await tx.update('practiceSettings', 'source', values);
			else await tx.insert('practiceSettings', { id: 'source', ...values });
		});
	}
});
export type PracticeSettingsRepository = ReturnType<typeof createPracticeSettingsRepository>;
