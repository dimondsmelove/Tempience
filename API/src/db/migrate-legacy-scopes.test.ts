import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const LEGACY_SCHEMA_SQL = `
CREATE TABLE traces (
	uid text PRIMARY KEY NOT NULL,
	captured_at text NOT NULL,
	timezone text NOT NULL,
	about_kind text NOT NULL,
	about_at text,
	about_start text,
	about_end text,
	about_trace_uid text,
	hook_text text NOT NULL,
	hook_kind text NOT NULL,
	relation text,
	valence integer,
	word text,
	task_ref text,
	idempotency_key text UNIQUE,
	source text NOT NULL DEFAULT 'capture',
	retracted_at text,
	created_at text NOT NULL
);
CREATE TABLE scopes (
	uid text PRIMARY KEY NOT NULL,
	kind text NOT NULL,
	name text NOT NULL,
	parent_scope_uid text,
	started_at text,
	ended_at text,
	note text,
	status text NOT NULL DEFAULT 'active',
	superseded_by_uid text,
	facet text,
	owner_uid text NOT NULL DEFAULT 'local-user',
	space_uid text NOT NULL DEFAULT 'personal',
	created_at text NOT NULL,
	updated_at text NOT NULL
);
CREATE TABLE scope_traces (
	scope_uid text NOT NULL,
	trace_uid text NOT NULL,
	created_at text NOT NULL,
	PRIMARY KEY (scope_uid, trace_uid)
);
CREATE TABLE continuity_segments (
	uid text PRIMARY KEY NOT NULL,
	continuity_uid text NOT NULL,
	phase text NOT NULL,
	start_at text,
	end_at text,
	label text,
	sort_order integer NOT NULL DEFAULT 0,
	created_at text NOT NULL
);
CREATE TABLE trace_relations (
	uid text PRIMARY KEY NOT NULL,
	from_trace_uid text NOT NULL,
	to_kind text NOT NULL,
	to_uid text NOT NULL,
	link_kind text NOT NULL DEFAULT 'relates_to',
	provenance text NOT NULL,
	creator text NOT NULL,
	evidence_json text NOT NULL DEFAULT '[]',
	status text NOT NULL DEFAULT 'active',
	owner_uid text NOT NULL DEFAULT 'local-user',
	space_uid text NOT NULL DEFAULT 'personal',
	label text,
	created_at text NOT NULL,
	updated_at text NOT NULL
);
CREATE TABLE continuities (
	uid text PRIMARY KEY NOT NULL,
	name text NOT NULL,
	kind text NOT NULL,
	status text NOT NULL DEFAULT 'active',
	started_at text,
	ended_at text,
	owner_uid text NOT NULL DEFAULT 'local-user',
	space_uid text NOT NULL DEFAULT 'personal',
	created_at text NOT NULL,
	updated_at text NOT NULL
);
CREATE TABLE links (
	uid text PRIMARY KEY NOT NULL,
	from_kind text NOT NULL,
	from_uid text NOT NULL,
	to_kind text NOT NULL,
	to_uid text NOT NULL,
	link_kind text NOT NULL,
	provenance text NOT NULL,
	creator text NOT NULL,
	evidence_json text NOT NULL DEFAULT '[]',
	status text NOT NULL DEFAULT 'active',
	owner_uid text NOT NULL DEFAULT 'local-user',
	space_uid text NOT NULL DEFAULT 'personal',
	label text,
	created_at text NOT NULL,
	updated_at text NOT NULL
);
`;

describe('migrateLegacyScopes', () => {
	let dbDir: string;

	beforeAll(() => {
		dbDir = mkdtempSync(join(tmpdir(), 'chronograph-f5-'));
		process.env.DATABASE_URL = `file:${join(dbDir, 'test.db')}`;
		const sqlite = new Database(process.env.DATABASE_URL.replace(/^file:/, ''));
		sqlite.exec(LEGACY_SCHEMA_SQL);
		sqlite.close();
	});

	beforeEach(() => {
		vi.resetModules();
	});

	afterAll(() => {
		rmSync(dbDir, { recursive: true, force: true });
	});

	it('migrates continuities and trace membership links into scopes and scope_traces', async () => {
		const { db } = await import('./client');
		const { migrateLegacyScopes } = await import('./migrate-legacy-scopes');
		const { scopeTraces, scopes } = await import('./schema');

		const ts = '2026-07-16T12:00:00.000Z';
		const sqlite = (await import('./client')).sqlite;

		sqlite
			.prepare(
				`INSERT INTO continuities (uid, name, kind, status, started_at, ended_at, owner_uid, space_uid, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run('c-a', 'Alpha', 'thread', 'active', ts, null, 'local-user', 'personal', ts, ts);

		sqlite
			.prepare(
				`INSERT INTO traces (uid, captured_at, timezone, about_kind, about_at, hook_text, hook_kind, source, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run('trace-1', ts, 'UTC', 'instant', ts, 'legacy hook', 'pulse', 'capture', ts);

		sqlite
			.prepare(
				`INSERT INTO links (uid, from_kind, from_uid, to_kind, to_uid, link_kind, provenance, creator, evidence_json, status, owner_uid, space_uid, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				'l1',
				'trace',
				'trace-1',
				'continuity',
				'c-a',
				'membership',
				'asserted',
				'user',
				'[]',
				'active',
				'local-user',
				'personal',
				ts,
				ts
			);

		const first = migrateLegacyScopes(sqlite);
		expect(first.continuities_migrated).toBe(1);
		expect(first.scope_traces_inserted).toBe(1);

		const scopeRows = await db.select().from(scopes);
		expect(scopeRows).toHaveLength(1);
		expect(scopeRows[0]?.facet).toBe('thread');

		const bindings = await db.select().from(scopeTraces);
		expect(bindings).toHaveLength(1);

		const second = migrateLegacyScopes(sqlite);
		expect(second.scope_traces_inserted).toBe(0);
	});

	it('dry-run does not write rows', async () => {
		const { migrateLegacyScopes } = await import('./migrate-legacy-scopes');
		const { sqlite } = await import('./client');

		const ts = '2026-07-17T12:00:00.000Z';
		sqlite
			.prepare(
				`INSERT INTO continuities (uid, name, kind, status, started_at, ended_at, owner_uid, space_uid, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run('c-dry', 'Dry', 'thread', 'active', ts, null, 'local-user', 'personal', ts, ts);

		const before = sqlite.prepare(`SELECT count(*) as c FROM scopes`).get() as { c: number };
		const dry = migrateLegacyScopes(sqlite, true);
		const after = sqlite.prepare(`SELECT count(*) as c FROM scopes`).get() as { c: number };

		expect(dry.continuities_migrated).toBeGreaterThanOrEqual(1);
		expect(after.c).toBe(before.c);
	});
});
