import type { SchemaQuery } from '@triplit/client';
import type { TempienceTriplitClient } from './client';
import type { schema } from './schema';

export const fetchReplica = async <Q extends SchemaQuery<typeof schema>>(
	client: TempienceTriplitClient,
	query: Q
) => {
	await client.ready;
	if (client.connectionStatus === 'OPEN') {
		let unsubscribe = () => {};
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			// Triplit 1.0.50 syncQuery has a TDZ rejection when a matching subscription
			// is already fulfilled. The public background subscription handles that case.
			await new Promise<void>((resolve, reject) => {
				timeout = setTimeout(resolve, 1000);
				unsubscribe = client.subscribeBackground(query, { onFulfilled: resolve, onError: reject });
			});
		} finally {
			clearTimeout(timeout);
			unsubscribe();
		}
	}
	return client.fetch(query, { policy: 'local-only' });
};
