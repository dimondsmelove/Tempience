import type { inquiries, scopePhases, traces } from '../db/schema';
import type { SyntheticMembershipLink } from './scope/scope-trace-bindings';

type TraceRow = typeof traces.$inferSelect;
type InquiryRow = typeof inquiries.$inferSelect;
type ScopePhaseRow = typeof scopePhases.$inferSelect;

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

export const mapTrace = (row: TraceRow) => ({
	uid: row.uid,
	captured_at: row.capturedAt,
	timezone: row.timezone,
	about_kind: row.aboutKind,
	about_at: row.aboutAt ?? null,
	about_start: row.aboutStart ?? null,
	about_end: row.aboutEnd ?? null,
	about_trace_uid: row.aboutTraceUid ?? null,
	hook_text: row.hookText,
	hook_kind: row.hookKind,
	relation: row.relation ?? null,
	valence: row.valence ?? null,
	word: row.word ?? null,
	task_ref: row.taskRef ?? null,
	intent_of_trace_uid: row.intentOfTraceUid ?? null,
	presence: row.presence ?? null,
	idempotency_key: row.idempotencyKey ?? null,
	source: row.source,
	retracted_at: row.retractedAt ?? null,
	created_at: row.createdAt,
	updated_at: row.createdAt
});

export const mapLink = (row: SyntheticMembershipLink) => ({
	uid: row.uid,
	from_kind: row.fromKind,
	from_uid: row.fromUid,
	to_kind: row.toKind,
	to_uid: row.toUid,
	link_kind: row.linkKind,
	provenance: row.provenance,
	creator: row.creator,
	evidence_refs: parseJsonUnknownArray(row.evidenceJson),
	status: row.status,
	owner_uid: row.ownerUid,
	space_uid: row.spaceUid,
	label: row.label ?? null,
	created_at: row.createdAt,
	updated_at: row.updatedAt
});

export const mapInquiry = (row: InquiryRow) => ({
	uid: row.uid,
	trigger_kind: row.triggerKind,
	subject_kind: row.subjectKind,
	subject_uid: row.subjectUid,
	wording: row.wording,
	options: parseJsonArray(row.optionsJson),
	evidence_refs: parseJsonUnknownArray(row.evidenceJson),
	user_response_kind: row.userResponseKind ?? null,
	user_response_text: row.userResponseText ?? null,
	status: row.status,
	owner_uid: row.ownerUid,
	space_uid: row.spaceUid,
	created_at: row.createdAt,
	updated_at: row.updatedAt
});

export const mapContinuitySegment = (row: ScopePhaseRow) => ({
	uid: row.uid,
	continuity_uid: row.continuityUid,
	phase: row.phase,
	start_at: row.startAt ?? null,
	end_at: row.endAt ?? null,
	label: row.label ?? null,
	sort_order: row.sortOrder,
	created_at: row.createdAt
});

export const mapContinuitySemanticTag = (row: {
	uid: string;
	continuityUid: string;
	tag: string;
	dimension: string;
	source: string;
	createdAt: string;
}) => ({
	uid: row.uid,
	continuity_uid: row.continuityUid,
	tag: row.tag,
	dimension: row.dimension,
	source: row.source,
	created_at: row.createdAt
});

export const mapTaskSegment = (row: ScopePhaseRow) => ({
	uid: row.uid,
	task_uid: row.continuityUid,
	phase: row.phase,
	start_at: row.startAt ?? null,
	end_at: row.endAt ?? null,
	label: row.label ?? null,
	sort_order: row.sortOrder,
	created_at: row.createdAt
});
