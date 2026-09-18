ALTER TABLE `traces` ADD `intent_of_trace_uid` text REFERENCES traces(uid) ON DELETE set null;
ALTER TABLE `traces` ADD `presence` text;
CREATE TABLE `scopes` (
	`uid` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`parent_scope_uid` text,
	`started_at` text,
	`ended_at` text,
	`note` text,
	`status` text DEFAULT 'active' NOT NULL,
	`superseded_by_uid` text,
	`facet` text,
	`owner_uid` text DEFAULT 'local-user' NOT NULL,
	`space_uid` text DEFAULT 'personal' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`parent_scope_uid`) REFERENCES `scopes`(`uid`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`superseded_by_uid`) REFERENCES `scopes`(`uid`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `scopes_kind_idx` ON `scopes` (`kind`);
CREATE INDEX `scopes_parent_scope_uid_idx` ON `scopes` (`parent_scope_uid`);
CREATE INDEX `scopes_status_idx` ON `scopes` (`status`);
CREATE TABLE `scope_traces` (
	`scope_uid` text NOT NULL,
	`trace_uid` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`scope_uid`) REFERENCES `scopes`(`uid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trace_uid`) REFERENCES `traces`(`uid`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `scope_traces_trace_uid_idx` ON `scope_traces` (`trace_uid`);
CREATE INDEX `scope_traces_scope_uid_idx` ON `scope_traces` (`scope_uid`);
CREATE UNIQUE INDEX `scope_traces_scope_uid_trace_uid_pk` ON `scope_traces` (`scope_uid`,`trace_uid`);
