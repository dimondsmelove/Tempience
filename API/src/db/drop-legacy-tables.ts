import { sqlite } from './client';

const LEGACY_TABLES = [
	'areas',
	'stitches',
	'period_closures',
	'links',
	'task_tags',
	'task_attachments',
	'task_segments',
	'tasks',
	'projects',
	'continuities'
] as const;

export type DropLegacyTablesResult = {
	dropped: string[];
	skipped: string[];
};

const hasTable = (table: string): boolean => {
	const row = sqlite
		.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
		.get(table) as { name?: string } | undefined;
	return row?.name === table;
};

export const dropLegacyTables = (dryRun = false): DropLegacyTablesResult => {
	const result: DropLegacyTablesResult = { dropped: [], skipped: [] };

	for (const table of LEGACY_TABLES) {
		if (!hasTable(table)) {
			result.skipped.push(table);
			continue;
		}
		if (!dryRun) {
			sqlite.exec(`DROP TABLE IF EXISTS ${table}`);
		}
		result.dropped.push(table);
	}

	return result;
};

if (process.argv[1]?.endsWith('drop-legacy-tables.ts')) {
	const dryRun = process.argv.includes('--dry-run');
	const result = dropLegacyTables(dryRun);
	console.log(
		JSON.stringify(
			{
				dry_run: dryRun,
				...result
			},
			null,
			2
		)
	);
}
