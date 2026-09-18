export const SCOPES_ONLY_SCHEMA_SQL = `
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
	intent_of_trace_uid text,
	presence text,
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
`;
