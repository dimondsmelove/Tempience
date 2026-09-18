import { TriplitClient } from '@triplit/client';
import { buildTriplitClientOptions } from '../client-options';
import { createImportedDataSpace, registerImportedDataSpace, type DataSpace } from '../data-space';
import { createBackupRepository } from './Backup';
import { parseDataSpaceBackup } from './parse';

/** A file always becomes a new local replica; file metadata cannot select a storage target. */
export const importDataSpaceBackup = async (input: unknown): Promise<DataSpace> => {
	const backup = parseDataSpaceBackup(input);
	const space = createImportedDataSpace(backup.dataSpace.label);
	const client = new TriplitClient(buildTriplitClientOptions(space, {}));
	try {
		await createBackupRepository(client, space).restore(backup);
		registerImportedDataSpace(space);
		return space;
	} catch (error) {
		// This client belongs only to the newly allocated replica. Registration failure must not
		// leave an undiscoverable copy of the imported data.
		await client.clear({ full: true });
		throw error;
	} finally {
		client.disconnect();
	}
};
