import { CodedError } from '$lib/model/Errors/CodedError';
import { fetchReplica } from './replica-fetch';
import type { TempienceTriplitClient } from './client';

export type ScopeCaptureSettings = { id: string; suggestedKindIds: string[] };

const normalizeScopeCaptureSettings = (row: {
	id: string;
	suggestedKindIds: unknown;
}): ScopeCaptureSettings => {
	if (
		!Array.isArray(row.suggestedKindIds) ||
		!row.suggestedKindIds.every((id) => typeof id === 'string')
	)
		throw new CodedError('capture_settings_format', 'Неизвестный формат настройки видов записи.');
	return { id: row.id, suggestedKindIds: [...new Set(row.suggestedKindIds as string[])] };
};

export function createScopeCaptureRepository(client: TempienceTriplitClient) {
	return {
		subscribeScopeCaptureSettings(
			next: (rows: ScopeCaptureSettings[]) => void,
			fail: (error: unknown) => void
		) {
			return client.subscribe(
				client.query('scopeCaptureSettings'),
				(rows) => next(rows.map(normalizeScopeCaptureSettings)),
				fail
			);
		},
		async listScopeCaptureSettings(): Promise<ScopeCaptureSettings[]> {
			const rows = await fetchReplica(client, client.query('scopeCaptureSettings'));
			return rows.map(normalizeScopeCaptureSettings);
		},
		async setScopeCaptureSettings(scopeId: string, kindIds: readonly string[]): Promise<void> {
			const suggestedKindIds = [...new Set(kindIds)];
			await client.transact(async (tx) => {
				const scope = await tx.fetchById('scopes', scopeId);
				if (!scope || scope.isDeleted)
					throw new CodedError('scope_missing', 'Выберите существующий Scope.');
				for (const id of suggestedKindIds) {
					if (!(await tx.fetchById('traceKinds', id)))
						throw new CodedError('kind_missing', 'Вид записи не найден.');
				}
				if (await tx.fetchById('scopeCaptureSettings', scopeId))
					await tx.update('scopeCaptureSettings', scopeId, { suggestedKindIds });
				else await tx.insert('scopeCaptureSettings', { id: scopeId, suggestedKindIds });
			});
		}
	};
}

export type ScopeCaptureRepository = ReturnType<typeof createScopeCaptureRepository>;
