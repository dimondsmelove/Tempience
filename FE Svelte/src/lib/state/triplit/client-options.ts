import type { ClientOptions } from '@triplit/client';
import type { DataSpace } from './data-space';
import { schema } from './schema';

export type TriplitConnection = Readonly<{
	serverUrl?: string;
	token?: string;
}>;

export const buildTriplitClientOptions = (
	dataSpace: DataSpace,
	connection: TriplitConnection
): ClientOptions<typeof schema> => {
	const localOptions: ClientOptions<typeof schema> = {
		schema,
		storage: { type: 'indexeddb', name: dataSpace.storageName },
		autoConnect: dataSpace.syncEnabled && Boolean(connection.serverUrl && connection.token)
	};

	if (!dataSpace.syncEnabled) return localOptions;

	return {
		...localOptions,
		...(connection.serverUrl ? { serverUrl: connection.serverUrl } : {}),
		...(connection.token ? { token: connection.token } : {})
	};
};
