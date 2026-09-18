import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { inquiries, traceRelations } from '../db/schema';
import { mapInquiry } from './temporal-mappers';
import { newUid, nowIso } from './time';
import type { CreateInquiryInput } from '@chronograph/shared';

export const insertInquiry = async (body: CreateInquiryInput) => {
	const ts = nowIso();
	const row = {
		uid: newUid(),
		triggerKind: body.trigger_kind,
		subjectKind: body.subject_kind,
		subjectUid: body.subject_uid,
		wording: body.wording,
		optionsJson: JSON.stringify(body.options ?? []),
		evidenceJson: JSON.stringify(body.evidence_refs ?? []),
		userResponseKind: null,
		userResponseText: null,
		status: 'open',
		ownerUid: body.owner_uid,
		spaceUid: body.space_uid,
		createdAt: ts,
		updatedAt: ts
	};

	await db.insert(inquiries).values(row);
	return row;
};

export const assertLinkByUid = async (uid: string, label?: string | null) => {
	const ts = nowIso();
	const [existing] = await db.select().from(traceRelations).where(eq(traceRelations.uid, uid));
	if (!existing || existing.status !== 'active') return null;
	if (existing.provenance === 'asserted') return existing;

	await db
		.update(traceRelations)
		.set({
			provenance: 'asserted',
			creator: 'user',
			label: label ?? existing.label,
			updatedAt: ts
		})
		.where(eq(traceRelations.uid, uid));

	const [row] = await db.select().from(traceRelations).where(eq(traceRelations.uid, uid));
	return row ?? null;
};

export const listInquiries = async (filters: {
	status?: string;
	subject_uid?: string;
	subject_kind?: string;
	trigger_kind?: string;
}) => {
	const clauses = [];
	if (filters.status) clauses.push(eq(inquiries.status, filters.status));
	if (filters.subject_uid) clauses.push(eq(inquiries.subjectUid, filters.subject_uid));
	if (filters.subject_kind) clauses.push(eq(inquiries.subjectKind, filters.subject_kind));
	if (filters.trigger_kind) clauses.push(eq(inquiries.triggerKind, filters.trigger_kind));

	const rows =
		clauses.length > 0
			? await db
					.select()
					.from(inquiries)
					.where(and(...clauses))
					.orderBy(asc(inquiries.createdAt))
			: await db.select().from(inquiries).orderBy(asc(inquiries.createdAt));

	return rows.map(mapInquiry);
};
