import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { ensureSchemaPatches } from './ensure-schema';
import { ensureLegacyScopesMigrated } from './migrate-legacy-scopes';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL ?? 'file:../data/chronograph.db';
const filePath = databaseUrl.replace(/^file:/, '');

const sqlite = new Database(filePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
ensureSchemaPatches(sqlite);
ensureLegacyScopesMigrated(sqlite);

export const db = drizzle(sqlite, { schema });
export { sqlite };
