import type { schema } from '../schema';
import type { BACKUP_FORMAT } from './constants';

export type BackupCollection = keyof typeof schema;
export type BackupEntity = { id: string; [key: string]: unknown };
export type DataSpaceBackup = {
	format: typeof BACKUP_FORMAT;
	exportedAt: string;
	dataSpace: { id: string; label: string };
	collections: Record<BackupCollection, BackupEntity[]>;
};
