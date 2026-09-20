import { TriplitClient } from '@triplit/client';
import { loadTiming } from '$lib/model/LoadTiming/LoadTiming';
import { getStoredToken, getTriplitServerUrl } from './auth';
import { buildTriplitClientOptions } from './client-options';
import { getActiveDataSpace } from './data-space';
import { installQueryCheckpoints } from './QueryCheckpoints/QueryCheckpoints';
import { schema } from './schema';

export type TempienceTriplitClient = TriplitClient<typeof schema>;

export const activeDataSpace = getActiveDataSpace();

// The active DataSpace is fixed for this module lifetime. Switching it reloads the app so every
// repository consumer moves together instead of observing a partially switched client graph.
// Storage hydration starts with the client and is timed until Triplit reports ready.
loadTiming.start('storage');
export const triplit = new TriplitClient(
	buildTriplitClientOptions(activeDataSpace, {
		serverUrl: getTriplitServerUrl(),
		token: getStoredToken()
	})
);
// Every query connects to the server from its own checkpoint, not from Triplit's one shared one
// (`QueryCheckpoints`): in place before the client can send anything.
installQueryCheckpoints(triplit);
const storageSettled = (): void => loadTiming.end('storage');
void triplit.ready.then(storageSettled, storageSettled);
