import type Database from 'better-sqlite3';
import { sqlite } from './client';

const hasTable = (db: Database.Database, table: string): boolean => {
	const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table) as
		| { name?: string }
		| undefined;
	return row?.name === table;
};

const SCOPE_FACETS = new Set(['thread', 'practice', 'relationship', 'condition']);

const toScopeFacet = (kind: string): string | null => (SCOPE_FACETS.has(kind) ? kind : null);

const taskScopeKind = (task: {
	parent_uid: string | null;
	project_uid: string | null;
}): 'process' | 'task' => (task.parent_uid ? 'task' : 'process');

const taskScopeStatus = (status: string): string => {
	switch (status) {
		case 'done':
		case 'archived':
		case 'cancelled':
			return 'completed';
		case 'in_progress':
		case 'waiting':
			return 'active';
		case 'planned':
			return 'planned';
		default:
			return 'active';
	}
};

export type MigrateLegacyScopesResult = {
	continuities_migrated: number;
	projects_migrated: number;
	tasks_migrated: number;
	scope_phases_migrated: number;
	scope_traces_inserted: number;
	trace_relations_inserted: number;
	parent_links_set: number;
	superseded_links_set: number;
};

export const migrateLegacyScopes = (sqlite: Database.Database, dryRun = false): MigrateLegacyScopesResult => {
	const result: MigrateLegacyScopesResult = {
		continuities_migrated: 0,
		projects_migrated: 0,
		tasks_migrated: 0,
		scope_phases_migrated: 0,
		scope_traces_inserted: 0,
		trace_relations_inserted: 0,
		parent_links_set: 0,
		superseded_links_set: 0
	};

	const run = dryRun
		? (fn: () => void) => fn()
		: (fn: () => void) => sqlite.transaction(fn)();

	run(() => {
		const insertScope = sqlite.prepare(`
			INSERT OR IGNORE INTO scopes (
				uid, kind, name, parent_scope_uid, started_at, ended_at, note, status,
				superseded_by_uid, facet, owner_uid, space_uid, created_at, updated_at
			) VALUES (
				@uid, @kind, @name, @parentScopeUid, @startedAt, @endedAt, @note, @status,
				@supersededByUid, @facet, @ownerUid, @spaceUid, @createdAt, @updatedAt
			)
		`);

		const insertScopeTrace = sqlite.prepare(`
			INSERT OR IGNORE INTO scope_traces (scope_uid, trace_uid, created_at)
			VALUES (@scopeUid, @traceUid, @createdAt)
		`);

		const insertScopePhase = sqlite.prepare(`
			INSERT OR IGNORE INTO continuity_segments (
				uid, continuity_uid, phase, start_at, end_at, label, sort_order, created_at
			) VALUES (
				@uid, @continuityUid, @phase, @startAt, @endAt, @label, @sortOrder, @createdAt
			)
		`);

		const insertTraceRelation = sqlite.prepare(`
			INSERT OR IGNORE INTO trace_relations (
				uid, from_trace_uid, to_kind, to_uid, link_kind, provenance, creator,
				evidence_json, status, owner_uid, space_uid, label, created_at, updated_at
			) VALUES (
				@uid, @fromTraceUid, @toKind, @toUid, @linkKind, @provenance, @creator,
				@evidenceJson, @status, @ownerUid, @spaceUid, @label, @createdAt, @updatedAt
			)
		`);

		const updateScopeParent = sqlite.prepare(`
			UPDATE scopes SET parent_scope_uid = @parentScopeUid, updated_at = @updatedAt
			WHERE uid = @uid AND (parent_scope_uid IS NULL OR parent_scope_uid = @parentScopeUid)
		`);

		const updateScopeSuperseded = sqlite.prepare(`
			UPDATE scopes SET superseded_by_uid = @supersededByUid, updated_at = @updatedAt
			WHERE uid = @uid AND (superseded_by_uid IS NULL OR superseded_by_uid = @supersededByUid)
		`);

		if (hasTable(sqlite, 'continuities')) {
			const rows = sqlite
				.prepare(
					`SELECT uid, name, kind, status, started_at, ended_at, owner_uid, space_uid, created_at, updated_at
					 FROM continuities ORDER BY created_at`
				)
				.all() as Array<{
				uid: string;
				name: string;
				kind: string;
				status: string;
				started_at: string | null;
				ended_at: string | null;
				owner_uid: string;
				space_uid: string;
				created_at: string;
				updated_at: string;
			}>;

			for (const row of rows) {
				const scopeStatus = row.status === 'completed' ? 'completed' : 'active';
				if (!dryRun) {
					const inserted = insertScope.run({
						uid: row.uid,
						kind: 'continuity',
						name: row.name,
						parentScopeUid: null,
						startedAt: row.started_at,
						endedAt: row.ended_at,
						note: null,
						status: scopeStatus,
						supersededByUid: null,
						facet: toScopeFacet(row.kind),
						ownerUid: row.owner_uid,
						spaceUid: row.space_uid,
						createdAt: row.created_at,
						updatedAt: row.updated_at
					});
					if (inserted.changes > 0) result.continuities_migrated += 1;
				} else {
					result.continuities_migrated += 1;
				}
			}
		}

		if (hasTable(sqlite, 'projects')) {
			const rows = sqlite
				.prepare(
					`SELECT uid, name, description, status, created_at, updated_at FROM projects ORDER BY created_at`
				)
				.all() as Array<{
				uid: string;
				name: string;
				description: string | null;
				status: string;
				created_at: string;
				updated_at: string;
			}>;

			for (const row of rows) {
				if (!dryRun) {
					const inserted = insertScope.run({
						uid: row.uid,
						kind: 'project',
						name: row.name,
						parentScopeUid: null,
						startedAt: null,
						endedAt: null,
						note: row.description,
						status: row.status === 'done' ? 'completed' : 'active',
						supersededByUid: null,
						facet: null,
						ownerUid: 'local-user',
						spaceUid: 'personal',
						createdAt: row.created_at,
						updatedAt: row.updated_at
					});
					if (inserted.changes > 0) result.projects_migrated += 1;
				} else {
					result.projects_migrated += 1;
				}
			}
		}

		if (hasTable(sqlite, 'tasks')) {
			const rows = sqlite
				.prepare(
					`SELECT uid, name, note, status, parent_uid, project_uid, started_at, ended_at, created_at, updated_at
					 FROM tasks ORDER BY created_at`
				)
				.all() as Array<{
				uid: string;
				name: string;
				note: string | null;
				status: string;
				parent_uid: string | null;
				project_uid: string | null;
				started_at: string | null;
				ended_at: string | null;
				created_at: string;
				updated_at: string;
			}>;

			for (const row of rows) {
				const kind = taskScopeKind(row);
				const parentScopeUid = row.parent_uid ?? row.project_uid ?? null;
				if (!dryRun) {
					const inserted = insertScope.run({
						uid: row.uid,
						kind,
						name: row.name,
						parentScopeUid,
						startedAt: row.started_at,
						endedAt: row.ended_at,
						note: row.note,
						status: taskScopeStatus(row.status),
						supersededByUid: null,
						facet: null,
						ownerUid: 'local-user',
						spaceUid: 'personal',
						createdAt: row.created_at,
						updatedAt: row.updated_at
					});
					if (inserted.changes > 0) result.tasks_migrated += 1;
				} else {
					result.tasks_migrated += 1;
				}
			}
		}

		if (hasTable(sqlite, 'task_segments')) {
			const rows = sqlite
				.prepare(
					`SELECT uid, task_uid, phase, start_at, end_at, label, sort_order, created_at
					 FROM task_segments ORDER BY sort_order`
				)
				.all() as Array<{
				uid: string;
				task_uid: string;
				phase: string;
				start_at: string | null;
				end_at: string | null;
				label: string | null;
				sort_order: number;
				created_at: string;
			}>;

			for (const row of rows) {
				if (!dryRun) {
					const inserted = insertScopePhase.run({
						uid: row.uid,
						continuityUid: row.task_uid,
						phase: row.phase,
						startAt: row.start_at,
						endAt: row.end_at,
						label: row.label,
						sortOrder: row.sort_order,
						createdAt: row.created_at
					});
					if (inserted.changes > 0) result.scope_phases_migrated += 1;
				} else {
					result.scope_phases_migrated += 1;
				}
			}
		}

		if (hasTable(sqlite, 'links')) {
			const membershipLinks = sqlite
				.prepare(
					`SELECT uid, from_kind, from_uid, to_kind, to_uid, link_kind, provenance, creator,
					        evidence_json, created_at, updated_at, label, owner_uid, space_uid
					 FROM links WHERE status = 'active' ORDER BY created_at`
				)
				.all() as Array<{
				uid: string;
				from_kind: string;
				from_uid: string;
				to_kind: string;
				to_uid: string;
				link_kind: string;
				provenance: string;
				creator: string;
				evidence_json: string;
				created_at: string;
				updated_at: string;
				label: string | null;
				owner_uid: string;
				space_uid: string;
			}>;

			for (const link of membershipLinks) {
				if (link.link_kind === 'membership' && link.from_kind === 'trace' && link.to_kind === 'continuity') {
					if (!dryRun) {
						const inserted = insertScopeTrace.run({
							scopeUid: link.to_uid,
							traceUid: link.from_uid,
							createdAt: link.created_at
						});
						if (inserted.changes > 0) result.scope_traces_inserted += 1;
					} else {
						result.scope_traces_inserted += 1;
					}
					continue;
				}

				if (link.link_kind === 'membership' && link.from_kind === 'trace' && link.to_kind === 'task') {
					if (!dryRun) {
						const inserted = insertScopeTrace.run({
							scopeUid: link.to_uid,
							traceUid: link.from_uid,
							createdAt: link.created_at
						});
						if (inserted.changes > 0) result.scope_traces_inserted += 1;
					} else {
						result.scope_traces_inserted += 1;
					}
					continue;
				}

				if (link.link_kind === 'membership' && link.from_kind === 'task' && link.to_kind === 'continuity') {
					if (!dryRun) {
						const updated = updateScopeParent.run({
							uid: link.from_uid,
							parentScopeUid: link.to_uid,
							updatedAt: link.updated_at
						});
						if (updated.changes > 0) result.parent_links_set += 1;
					} else {
						result.parent_links_set += 1;
					}
					continue;
				}

				if (link.link_kind === 'replaced_by' && link.from_kind === 'task' && link.to_kind === 'task') {
					if (!dryRun) {
						const updated = updateScopeSuperseded.run({
							uid: link.from_uid,
							supersededByUid: link.to_uid,
							updatedAt: link.updated_at
						});
						if (updated.changes > 0) result.superseded_links_set += 1;
					} else {
						result.superseded_links_set += 1;
					}
					continue;
				}

				if (link.link_kind === 'relates_to' && link.from_kind === 'trace') {
					if (!dryRun) {
						const inserted = insertTraceRelation.run({
							uid: link.uid,
							fromTraceUid: link.from_uid,
							toKind: link.to_kind,
							toUid: link.to_uid,
							linkKind: 'relates_to',
							provenance: link.provenance,
							creator: link.creator,
							evidenceJson: link.evidence_json,
							status: 'active',
							ownerUid: link.owner_uid,
							spaceUid: link.space_uid,
							label: link.label,
							createdAt: link.created_at,
							updatedAt: link.updated_at
						});
						if (inserted.changes > 0) result.trace_relations_inserted += 1;
					} else {
						result.trace_relations_inserted += 1;
					}
				}
			}
		}
	});

	return result;
};

if (process.argv[1]?.endsWith('migrate-legacy-scopes.ts')) {
	const dryRun = process.argv.includes('--dry-run');
	const result = migrateLegacyScopes(dryRun);
	console.log(JSON.stringify({ dry_run: dryRun, ...result }, null, 2));
}

const legacyRowCount = (sqlite: import('better-sqlite3').Database): number => {
	let total = 0;
	if (hasTable(sqlite, 'continuities')) {
		total += (sqlite.prepare('SELECT COUNT(*) AS c FROM continuities').get() as { c: number }).c;
	}
	if (hasTable(sqlite, 'tasks')) {
		total += (sqlite.prepare('SELECT COUNT(*) AS c FROM tasks').get() as { c: number }).c;
	}
	return total;
};

/** Idempotent: backfill scopes from legacy tables when scopes is empty. */
export const ensureLegacyScopesMigrated = (sqlite: import('better-sqlite3').Database): void => {
	const scopeCount = (sqlite.prepare('SELECT COUNT(*) AS c FROM scopes').get() as { c: number }).c;
	if (scopeCount > 0) return;
	if (legacyRowCount(sqlite) === 0) return;
	const result = migrateLegacyScopes(sqlite, false);
	console.log('[scope-chart] legacy scopes migrated:', JSON.stringify(result));
};
