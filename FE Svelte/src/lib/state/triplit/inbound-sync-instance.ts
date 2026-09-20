import { getStoredToken, getTriplitServerUrl } from './auth';
import { activeDataSpace, triplit } from './client';
import { assertStorageSchemaReady } from './Repository/readiness';
import { createInboundFeed } from './inbound-sync';

/**
 * The one inbound feed of the app, on the one client: read when the active space syncs and
 * this browser is paired with a server — the same condition under which the client connects
 * at all (`client-options.ts`). A local-only space, a public build and an unpaired browser
 * keep every request off the wire.
 */
export const inboundFeed = createInboundFeed(triplit, {
	enabled:
		activeDataSpace.syncEnabled && Boolean(getTriplitServerUrl()) && Boolean(getStoredToken()),
	ready: () => assertStorageSchemaReady(triplit)
});
