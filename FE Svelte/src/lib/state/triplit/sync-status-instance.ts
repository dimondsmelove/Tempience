import { activeDataSpace, triplit } from './client';
import { getTriplitServerUrl } from './auth';
import { createSyncStatusStore } from './sync-status';

export const syncStatus = createSyncStatusStore(triplit, {
	syncEnabled: activeDataSpace.syncEnabled && Boolean(getTriplitServerUrl())
});
