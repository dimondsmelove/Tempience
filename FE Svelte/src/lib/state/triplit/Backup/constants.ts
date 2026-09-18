import { schema } from '../schema';
import type { BackupCollection } from './types';

export const BACKUP_FORMAT = 'tempience.data-space.v1';
export const BACKUP_COLLECTIONS = Object.keys(schema) as BackupCollection[];

/** The collections of the first published export (PR #27, d948e1d); every file must carry them. */
export const ORIGINAL_BACKUP_COLLECTIONS: readonly BackupCollection[] = [
	'uiThemes',
	'uiAppearance',
	'traceKinds',
	'traceKindVersions',
	'traces',
	'periods',
	'scopes',
	'scopeSegments',
	'intersections',
	'sources',
	'assertions',
	'citations',
	'assertionRelations',
	'provenanceLinks',
	'logs'
];

/**
 * Exact collection sets of every export this format has shipped, oldest first:
 * original 15, C10 with Scope capture settings (9cd1fe3), current with assessments.
 * A file must match one profile exactly; collections introduced later restore as empty.
 */
export const BACKUP_COLLECTION_PROFILES: readonly (readonly BackupCollection[])[] = [
	ORIGINAL_BACKUP_COLLECTIONS,
	[...ORIGINAL_BACKUP_COLLECTIONS, 'scopeCaptureSettings'],
	[...ORIGINAL_BACKUP_COLLECTIONS, 'scopeCaptureSettings', 'intentionAssessments']
];
