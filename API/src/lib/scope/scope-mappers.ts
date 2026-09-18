import type { Continuity, Scope, ScopeEntity, ScopeFacet, ScopeKind, ScopeStatus, Task } from '@chronograph/shared';
import type { scopes } from '../../db/schema';

type ScopeRow = typeof scopes.$inferSelect;

const continuityStatus = (row: ScopeRow): Continuity['status'] => {
	if (row.status === 'completed') return 'completed';
	if (row.status === 'dormant') return 'dormant';
	return 'active';
};

export const mapScopeEntity = (row: ScopeRow): ScopeEntity => ({
	uid: row.uid,
	kind: row.kind as ScopeKind,
	name: row.name,
	status: row.kind === 'continuity' ? continuityStatus(row) : row.status,
	started_at: row.startedAt ?? null,
	ended_at: row.endedAt ?? null,
	note: row.note ?? null
});

export const scopeToContinuity = (row: ScopeRow): Continuity => ({
	uid: row.uid,
	name: row.name,
	kind: (row.facet ?? 'thread') as Continuity['kind'],
	status: continuityStatus(row),
	started_at: row.startedAt ?? null,
	ended_at: row.endedAt ?? null,
	owner_uid: row.ownerUid,
	space_uid: row.spaceUid,
	created_at: row.createdAt,
	updated_at: row.updatedAt
});

const scopeStatusToTaskStatus = (status: string): Task['status'] => {
	switch (status) {
		case 'completed':
			return 'done';
		case 'active':
			return 'in_progress';
		case 'planned':
			return 'planned';
		default:
			return 'not_started';
	}
};

export const scopeToTask = (row: ScopeRow, projectUid: string | null = null): Task => ({
	uid: row.uid,
	name: row.name,
	note: row.note ?? null,
	status: scopeStatusToTaskStatus(row.status),
	priority: null,
	due_date: null,
	defer_until: null,
	reminder_at: null,
	parent_uid: row.parentScopeUid ?? null,
	position: 0,
	project_uid: projectUid,
	completed_at: row.status === 'completed' ? row.endedAt ?? null : null,
	started_at: row.startedAt ?? null,
	ended_at: row.endedAt ?? null,
	created_at: row.createdAt,
	updated_at: row.updatedAt
});

export const mapScope = (row: ScopeRow): Scope => ({
	uid: row.uid,
	kind: row.kind as ScopeKind,
	name: row.name,
	parent_scope_uid: row.parentScopeUid ?? null,
	started_at: row.startedAt ?? null,
	ended_at: row.endedAt ?? null,
	note: row.note ?? null,
	status: (row.status === 'completed' ? 'completed' : 'active') as ScopeStatus,
	superseded_by_uid: row.supersededByUid ?? null,
	facet: (row.facet as ScopeFacet | null) ?? null,
	owner_uid: row.ownerUid,
	space_uid: row.spaceUid,
	created_at: row.createdAt,
	updated_at: row.updatedAt
});
