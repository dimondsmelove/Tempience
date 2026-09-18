import type Database from 'better-sqlite3';

const hasTable = (sqlite: Database.Database, table: string): boolean => {
	const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table) as
		| { name?: string }
		| undefined;
	return row?.name === table;
};

const hasColumn = (sqlite: Database.Database, table: string, column: string): boolean => {
	if (!hasTable(sqlite, table)) return false;
	const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	return rows.some((row) => row.name === column);
};

/** Applies additive schema patches when drizzle-kit push is blocked. */
export const ensureSchemaPatches = (sqlite: Database.Database): void => {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS inquiries (
			uid text PRIMARY KEY NOT NULL,
			trigger_kind text NOT NULL,
			subject_kind text NOT NULL,
			subject_uid text NOT NULL,
			wording text NOT NULL,
			options_json text DEFAULT '[]' NOT NULL,
			evidence_json text DEFAULT '[]' NOT NULL,
			user_response_kind text,
			user_response_text text,
			status text DEFAULT 'open' NOT NULL,
			owner_uid text DEFAULT 'local-user' NOT NULL,
			space_uid text DEFAULT 'personal' NOT NULL,
			created_at text NOT NULL,
			updated_at text NOT NULL
		);
		CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries (status);
		CREATE INDEX IF NOT EXISTS inquiries_subject_uid_idx ON inquiries (subject_uid);

		CREATE TABLE IF NOT EXISTS trigger_candidates (
			uid text PRIMARY KEY NOT NULL,
			kind text NOT NULL,
			subject_kind text NOT NULL,
			subject_uid text NOT NULL,
			proposed_action text NOT NULL,
			wording text,
			evidence_json text DEFAULT '[]' NOT NULL,
			earliest_at text NOT NULL,
			expires_at text,
			priority text DEFAULT 'quiet' NOT NULL,
			status text DEFAULT 'pending' NOT NULL,
			owner_uid text DEFAULT 'local-user' NOT NULL,
			space_uid text DEFAULT 'personal' NOT NULL,
			created_at text NOT NULL,
			updated_at text NOT NULL
		);
		CREATE INDEX IF NOT EXISTS trigger_candidates_status_idx ON trigger_candidates (status);
		CREATE INDEX IF NOT EXISTS trigger_candidates_subject_uid_idx ON trigger_candidates (subject_uid);

		CREATE TABLE IF NOT EXISTS trigger_deliveries (
			uid text PRIMARY KEY NOT NULL,
			candidate_uid text NOT NULL,
			channel text NOT NULL,
			delivered_at text NOT NULL,
			dismissed_at text,
			idempotency_key text NOT NULL UNIQUE,
			created_at text NOT NULL,
			updated_at text NOT NULL
		);
		CREATE INDEX IF NOT EXISTS trigger_deliveries_candidate_uid_idx ON trigger_deliveries (candidate_uid);
	`);

	if (!hasColumn(sqlite, 'traces', 'retracted_at')) {
		sqlite.exec(`ALTER TABLE traces ADD COLUMN retracted_at text;`);
	}

	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS continuity_semantic_tags (
			uid text PRIMARY KEY NOT NULL,
			continuity_uid text NOT NULL,
			tag text NOT NULL,
			dimension text NOT NULL,
			source text NOT NULL DEFAULT 'free',
			created_at text NOT NULL
		);
		CREATE INDEX IF NOT EXISTS continuity_semantic_tags_continuity_uid_idx ON continuity_semantic_tags (continuity_uid);
		CREATE INDEX IF NOT EXISTS continuity_semantic_tags_tag_idx ON continuity_semantic_tags (tag);

		CREATE TABLE IF NOT EXISTS thread_cooccurrence (
			uid text PRIMARY KEY NOT NULL,
			thread_a_uid text NOT NULL,
			thread_b_uid text NOT NULL,
			intersection_count integer NOT NULL DEFAULT 0,
			last_at text NOT NULL,
			bridge_trace_uids_json text NOT NULL DEFAULT '[]'
		);
		CREATE INDEX IF NOT EXISTS thread_cooccurrence_pair_idx ON thread_cooccurrence (thread_a_uid, thread_b_uid);

		CREATE TABLE IF NOT EXISTS space_profiles (
			space_uid text PRIMARY KEY NOT NULL,
			birth_date text,
			life_horizon_years integer DEFAULT 100 NOT NULL,
			timezone text DEFAULT 'UTC' NOT NULL,
			owner_uid text DEFAULT 'local-user' NOT NULL,
			created_at text NOT NULL,
			updated_at text NOT NULL
		);

		CREATE VIRTUAL TABLE IF NOT EXISTS search_documents USING fts5(
			doc_uid UNINDEXED,
			doc_kind UNINDEXED,
			continuity_uid UNINDEXED,
			body,
			tokenize='unicode61'
		);
	`);

	if (!hasColumn(sqlite, 'traces', 'intent_of_trace_uid')) {
		sqlite.exec(
			`ALTER TABLE traces ADD COLUMN intent_of_trace_uid text REFERENCES traces(uid) ON DELETE SET NULL;`
		);
	}
	if (!hasColumn(sqlite, 'traces', 'presence')) {
		sqlite.exec(`ALTER TABLE traces ADD COLUMN presence text;`);
	}

	if (!hasTable(sqlite, 'scopes')) {
		sqlite.exec(`
			CREATE TABLE scopes (
				uid text PRIMARY KEY NOT NULL,
				kind text NOT NULL,
				name text NOT NULL,
				parent_scope_uid text REFERENCES scopes(uid) ON DELETE SET NULL,
				started_at text,
				ended_at text,
				note text,
				status text DEFAULT 'active' NOT NULL,
				superseded_by_uid text REFERENCES scopes(uid) ON DELETE SET NULL,
				facet text,
				owner_uid text DEFAULT 'local-user' NOT NULL,
				space_uid text DEFAULT 'personal' NOT NULL,
				created_at text NOT NULL,
				updated_at text NOT NULL
			);
			CREATE INDEX IF NOT EXISTS scopes_kind_idx ON scopes (kind);
			CREATE INDEX IF NOT EXISTS scopes_parent_scope_uid_idx ON scopes (parent_scope_uid);
			CREATE INDEX IF NOT EXISTS scopes_status_idx ON scopes (status);
		`);
	}

	if (!hasTable(sqlite, 'scope_traces')) {
		sqlite.exec(`
			CREATE TABLE scope_traces (
				scope_uid text NOT NULL REFERENCES scopes(uid) ON DELETE CASCADE,
				trace_uid text NOT NULL REFERENCES traces(uid) ON DELETE CASCADE,
				created_at text NOT NULL,
				PRIMARY KEY (scope_uid, trace_uid)
			);
			CREATE INDEX IF NOT EXISTS scope_traces_trace_uid_idx ON scope_traces (trace_uid);
			CREATE INDEX IF NOT EXISTS scope_traces_scope_uid_idx ON scope_traces (scope_uid);
		`);
	}

	if (!hasTable(sqlite, 'continuity_segments')) {
		sqlite.exec(`
			CREATE TABLE continuity_segments (
				uid text PRIMARY KEY NOT NULL,
				continuity_uid text NOT NULL,
				phase text NOT NULL,
				start_at text,
				end_at text,
				label text,
				sort_order integer DEFAULT 0 NOT NULL,
				created_at text NOT NULL,
				FOREIGN KEY (continuity_uid) REFERENCES scopes(uid) ON DELETE CASCADE
			);
			CREATE INDEX IF NOT EXISTS continuity_segments_continuity_uid_idx ON continuity_segments (continuity_uid);
		`);
	}

	if (!hasTable(sqlite, 'trace_relations')) {
		sqlite.exec(`
			CREATE TABLE trace_relations (
				uid text PRIMARY KEY NOT NULL,
				from_trace_uid text NOT NULL REFERENCES traces(uid) ON DELETE CASCADE,
				to_kind text NOT NULL,
				to_uid text NOT NULL,
				link_kind text DEFAULT 'relates_to' NOT NULL,
				provenance text NOT NULL,
				creator text NOT NULL,
				evidence_json text DEFAULT '[]' NOT NULL,
				status text DEFAULT 'active' NOT NULL,
				owner_uid text DEFAULT 'local-user' NOT NULL,
				space_uid text DEFAULT 'personal' NOT NULL,
				label text,
				created_at text NOT NULL,
				updated_at text NOT NULL
			);
			CREATE INDEX IF NOT EXISTS trace_relations_from_trace_uid_idx ON trace_relations (from_trace_uid);
			CREATE INDEX IF NOT EXISTS trace_relations_to_uid_idx ON trace_relations (to_uid);
			CREATE INDEX IF NOT EXISTS trace_relations_status_idx ON trace_relations (status);
		`);
	}
};
