CREATE TABLE `areas` (
	`uid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `period_closures` (
	`uid` text PRIMARY KEY NOT NULL,
	`period_kind` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`version` integer NOT NULL,
	`supersedes_uid` text,
	`summary` text,
	`trace_uids_json` text DEFAULT '[]' NOT NULL,
	`stitch_uids_json` text DEFAULT '[]' NOT NULL,
	`child_closure_uids_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `period_closures_kind_start_idx` ON `period_closures` (`period_kind`,`period_start`);--> statement-breakpoint
CREATE INDEX `period_closures_version_idx` ON `period_closures` (`period_kind`,`period_start`,`version`);--> statement-breakpoint
CREATE TABLE `projects` (
	`uid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`area_uid` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`due_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`area_uid`) REFERENCES `areas`(`uid`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `projects_area_uid_idx` ON `projects` (`area_uid`);--> statement-breakpoint
CREATE TABLE `stitches` (
	`uid` text PRIMARY KEY NOT NULL,
	`label` text,
	`trace_uids_json` text NOT NULL,
	`superseded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`uid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `task_attachments` (
	`uid` text PRIMARY KEY NOT NULL,
	`task_uid` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_path` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_uid`) REFERENCES `tasks`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_attachments_task_uid_idx` ON `task_attachments` (`task_uid`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`task_uid` text NOT NULL,
	`tag_uid` text NOT NULL,
	PRIMARY KEY(`task_uid`, `tag_uid`),
	FOREIGN KEY (`task_uid`) REFERENCES `tasks`(`uid`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_uid`) REFERENCES `tags`(`uid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`uid` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`priority` integer,
	`due_date` text,
	`defer_until` text,
	`reminder_at` text,
	`parent_uid` text,
	`position` integer DEFAULT 0 NOT NULL,
	`project_uid` text,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`parent_uid`) REFERENCES `tasks`(`uid`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_uid`) REFERENCES `projects`(`uid`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_parent_uid_idx` ON `tasks` (`parent_uid`);--> statement-breakpoint
CREATE INDEX `tasks_project_uid_idx` ON `tasks` (`project_uid`);--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_parent_position_idx` ON `tasks` (`parent_uid`,`position`);--> statement-breakpoint
CREATE TABLE `traces` (
	`uid` text PRIMARY KEY NOT NULL,
	`captured_at` text NOT NULL,
	`timezone` text NOT NULL,
	`about_kind` text NOT NULL,
	`about_at` text,
	`about_start` text,
	`about_end` text,
	`about_trace_uid` text,
	`hook_text` text NOT NULL,
	`hook_kind` text NOT NULL,
	`relation` text,
	`valence` integer,
	`word` text,
	`task_ref` text,
	`idempotency_key` text,
	`source` text DEFAULT 'capture' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `traces_captured_at_idx` ON `traces` (`captured_at`);--> statement-breakpoint
CREATE INDEX `traces_about_start_idx` ON `traces` (`about_start`);--> statement-breakpoint
CREATE UNIQUE INDEX `traces_idempotency_key_idx` ON `traces` (`idempotency_key`);