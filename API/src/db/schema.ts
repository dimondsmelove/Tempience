import { sqliteTable, text, integer, primaryKey, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

export const tags = sqliteTable('tags', {
	uid: text('uid').primaryKey(),
	name: text('name').notNull().unique(),
	createdAt: text('created_at').notNull()
});

export const traces = sqliteTable(
	'traces',
	{
		uid: text('uid').primaryKey(),
		capturedAt: text('captured_at').notNull(),
		timezone: text('timezone').notNull(),
		aboutKind: text('about_kind').notNull(),
		aboutAt: text('about_at'),
		aboutStart: text('about_start'),
		aboutEnd: text('about_end'),
		aboutTraceUid: text('about_trace_uid'),
		hookText: text('hook_text').notNull(),
		hookKind: text('hook_kind').notNull(),
		relation: text('relation'),
		valence: integer('valence'),
		word: text('word'),
		taskRef: text('task_ref'),
		intentOfTraceUid: text('intent_of_trace_uid').references((): AnySQLiteColumn => traces.uid, {
			onDelete: 'set null'
		}),
		presence: text('presence'),
		idempotencyKey: text('idempotency_key'),
		source: text('source').notNull().default('capture'),
		retractedAt: text('retracted_at'),
		createdAt: text('created_at').notNull()
	},
	(table) => [
		index('traces_captured_at_idx').on(table.capturedAt),
		index('traces_about_start_idx').on(table.aboutStart),
		uniqueIndex('traces_idempotency_key_idx').on(table.idempotencyKey)
	]
);

export const scopes = sqliteTable(
	'scopes',
	{
		uid: text('uid').primaryKey(),
		kind: text('kind').notNull(),
		name: text('name').notNull(),
		parentScopeUid: text('parent_scope_uid').references((): AnySQLiteColumn => scopes.uid, {
			onDelete: 'set null'
		}),
		startedAt: text('started_at'),
		endedAt: text('ended_at'),
		note: text('note'),
		status: text('status').notNull().default('active'),
		supersededByUid: text('superseded_by_uid').references((): AnySQLiteColumn => scopes.uid, {
			onDelete: 'set null'
		}),
		facet: text('facet'),
		ownerUid: text('owner_uid').notNull().default('local-user'),
		spaceUid: text('space_uid').notNull().default('personal'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		index('scopes_kind_idx').on(table.kind),
		index('scopes_parent_scope_uid_idx').on(table.parentScopeUid),
		index('scopes_status_idx').on(table.status)
	]
);

export const scopeTraces = sqliteTable(
	'scope_traces',
	{
		scopeUid: text('scope_uid')
			.notNull()
			.references(() => scopes.uid, { onDelete: 'cascade' }),
		traceUid: text('trace_uid')
			.notNull()
			.references(() => traces.uid, { onDelete: 'cascade' }),
		createdAt: text('created_at').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.scopeUid, table.traceUid] }),
		index('scope_traces_trace_uid_idx').on(table.traceUid),
		index('scope_traces_scope_uid_idx').on(table.scopeUid)
	]
);

/** Physical table continuity_segments; continuity_uid references scopes.uid */
export const scopePhases = sqliteTable(
	'continuity_segments',
	{
		uid: text('uid').primaryKey(),
		continuityUid: text('continuity_uid')
			.notNull()
			.references(() => scopes.uid, { onDelete: 'cascade' }),
		phase: text('phase').notNull(),
		startAt: text('start_at'),
		endAt: text('end_at'),
		label: text('label'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: text('created_at').notNull()
	},
	(table) => [index('continuity_segments_continuity_uid_idx').on(table.continuityUid)]
);

export const continuitySegments = scopePhases;

export const traceRelations = sqliteTable(
	'trace_relations',
	{
		uid: text('uid').primaryKey(),
		fromTraceUid: text('from_trace_uid')
			.notNull()
			.references(() => traces.uid, { onDelete: 'cascade' }),
		toKind: text('to_kind').notNull(),
		toUid: text('to_uid').notNull(),
		linkKind: text('link_kind').notNull().default('relates_to'),
		provenance: text('provenance').notNull(),
		creator: text('creator').notNull(),
		evidenceJson: text('evidence_json').notNull().default('[]'),
		status: text('status').notNull().default('active'),
		ownerUid: text('owner_uid').notNull().default('local-user'),
		spaceUid: text('space_uid').notNull().default('personal'),
		label: text('label'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		index('trace_relations_from_trace_uid_idx').on(table.fromTraceUid),
		index('trace_relations_to_uid_idx').on(table.toUid),
		index('trace_relations_status_idx').on(table.status)
	]
);

export const inquiries = sqliteTable(
	'inquiries',
	{
		uid: text('uid').primaryKey(),
		triggerKind: text('trigger_kind').notNull(),
		subjectKind: text('subject_kind').notNull(),
		subjectUid: text('subject_uid').notNull(),
		wording: text('wording').notNull(),
		optionsJson: text('options_json').notNull().default('[]'),
		evidenceJson: text('evidence_json').notNull().default('[]'),
		userResponseKind: text('user_response_kind'),
		userResponseText: text('user_response_text'),
		status: text('status').notNull().default('open'),
		ownerUid: text('owner_uid').notNull().default('local-user'),
		spaceUid: text('space_uid').notNull().default('personal'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		index('inquiries_status_idx').on(table.status),
		index('inquiries_subject_uid_idx').on(table.subjectUid)
	]
);

export const triggerCandidates = sqliteTable(
	'trigger_candidates',
	{
		uid: text('uid').primaryKey(),
		kind: text('kind').notNull(),
		subjectKind: text('subject_kind').notNull(),
		subjectUid: text('subject_uid').notNull(),
		proposedAction: text('proposed_action').notNull(),
		wording: text('wording'),
		evidenceJson: text('evidence_json').notNull().default('[]'),
		earliestAt: text('earliest_at').notNull(),
		expiresAt: text('expires_at'),
		priority: text('priority').notNull().default('quiet'),
		status: text('status').notNull().default('pending'),
		ownerUid: text('owner_uid').notNull().default('local-user'),
		spaceUid: text('space_uid').notNull().default('personal'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [
		index('trigger_candidates_status_idx').on(table.status),
		index('trigger_candidates_subject_uid_idx').on(table.subjectUid)
	]
);

export const triggerDeliveries = sqliteTable(
	'trigger_deliveries',
	{
		uid: text('uid').primaryKey(),
		candidateUid: text('candidate_uid').notNull(),
		channel: text('channel').notNull(),
		deliveredAt: text('delivered_at').notNull(),
		dismissedAt: text('dismissed_at'),
		idempotencyKey: text('idempotency_key').notNull().unique(),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(table) => [index('trigger_deliveries_candidate_uid_idx').on(table.candidateUid)]
);

export const continuitySemanticTags = sqliteTable(
	'continuity_semantic_tags',
	{
		uid: text('uid').primaryKey(),
		continuityUid: text('continuity_uid').notNull(),
		tag: text('tag').notNull(),
		dimension: text('dimension').notNull(),
		source: text('source').notNull().default('free'),
		createdAt: text('created_at').notNull()
	},
	(table) => [
		index('continuity_semantic_tags_continuity_uid_idx').on(table.continuityUid),
		index('continuity_semantic_tags_tag_idx').on(table.tag)
	]
);

export const threadCooccurrence = sqliteTable(
	'thread_cooccurrence',
	{
		uid: text('uid').primaryKey(),
		threadAUid: text('thread_a_uid').notNull(),
		threadBUid: text('thread_b_uid').notNull(),
		intersectionCount: integer('intersection_count').notNull().default(0),
		lastAt: text('last_at').notNull(),
		bridgeTraceUidsJson: text('bridge_trace_uids_json').notNull().default('[]')
	},
	(table) => [index('thread_cooccurrence_pair_idx').on(table.threadAUid, table.threadBUid)]
);

export const spaceProfiles = sqliteTable('space_profiles', {
	spaceUid: text('space_uid').primaryKey(),
	birthDate: text('birth_date'),
	lifeHorizonYears: integer('life_horizon_years').notNull().default(100),
	timezone: text('timezone').notNull().default('UTC'),
	ownerUid: text('owner_uid').notNull().default('local-user'),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});
