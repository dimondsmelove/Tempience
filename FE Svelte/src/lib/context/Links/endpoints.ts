import type { MessageKey } from '$lib/state/Locale/types';
import type { EndpointState } from '$lib/state/Records/types';

/** What a row says about a record the active timeline does not carry. */
export const ENDPOINT_KEYS: Record<EndpointState, MessageKey> = {
	active: 'link.endpointActive',
	deleted: 'link.endpointDeleted',
	unavailable: 'link.endpointUnavailable'
};
