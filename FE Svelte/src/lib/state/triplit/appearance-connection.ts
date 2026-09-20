import { TriplitClient } from '@triplit/client';
import { getStoredToken, getTriplitServerUrl } from './auth';
import { createAppearanceRepository } from './appearance-repository';
import { installQueryCheckpoints } from './QueryCheckpoints/QueryCheckpoints';
import { schema } from './schema';

// Personalization survives clearing or switching domain DataSpaces.
export const APPEARANCE_STORAGE_NAME = 'tempience-appearance';
export function openAppearanceConnection() {
	const serverUrl = getTriplitServerUrl(),
		token = getStoredToken();
	const client = new TriplitClient({
		schema,
		storage: { type: 'indexeddb' as const, name: APPEARANCE_STORAGE_NAME },
		...(serverUrl ? { serverUrl } : {}),
		...(token ? { token } : {}),
		autoConnect: Boolean(serverUrl && token)
	});
	// The same checkpoint per query as the data client (`QueryCheckpoints`).
	installQueryCheckpoints(client);
	return {
		client,
		repository: createAppearanceRepository(client),
		paired: Boolean(serverUrl && token)
	};
}
