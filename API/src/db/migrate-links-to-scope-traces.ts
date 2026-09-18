import { migrateLegacyScopes } from './migrate-legacy-scopes';

const dryRun = process.argv.includes('--dry-run');

const result = migrateLegacyScopes(sqlite, dryRun);

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
