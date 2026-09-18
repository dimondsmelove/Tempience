import type { triggerCandidates, triggerDeliveries } from '../../db/schema';

type TriggerCandidateRow = typeof triggerCandidates.$inferSelect;
type TriggerDeliveryRow = typeof triggerDeliveries.$inferSelect;

const parseJsonArray = (raw: string): string[] => {
	try {
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
	} catch {
		return [];
	}
};

const parseJsonUnknownArray = (raw: string): unknown[] => {
	try {
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

export const mapTriggerCandidate = (row: TriggerCandidateRow) => ({
	uid: row.uid,
	kind: row.kind,
	subject_kind: row.subjectKind,
	subject_uid: row.subjectUid,
	proposed_action: row.proposedAction,
	wording: row.wording ?? null,
	evidence_refs: parseJsonUnknownArray(row.evidenceJson),
	earliest_at: row.earliestAt,
	expires_at: row.expiresAt ?? null,
	priority: row.priority,
	status: row.status,
	owner_uid: row.ownerUid,
	space_uid: row.spaceUid,
	created_at: row.createdAt,
	updated_at: row.updatedAt
});

export const mapTriggerDelivery = (row: TriggerDeliveryRow) => ({
	uid: row.uid,
	candidate_uid: row.candidateUid,
	channel: row.channel,
	delivered_at: row.deliveredAt,
	dismissed_at: row.dismissedAt ?? null,
	idempotency_key: row.idempotencyKey,
	created_at: row.createdAt,
	updated_at: row.updatedAt
});

export const parseDeliveryCountToday = (rows: TriggerDeliveryRow[], anchorAt: string): number => {
	const day = anchorAt.slice(0, 10);
	return rows.filter((row) => row.deliveredAt.startsWith(day) && !row.dismissedAt).length;
};

export const subjectCooldownKeys = (rows: TriggerDeliveryRow[]): Set<string> =>
	new Set(rows.map((row) => row.idempotencyKey.split(':')[0] ?? row.candidateUid));
