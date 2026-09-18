import {
	answerInquirySchema,
	createInquirySchema,
	inquiryListQuerySchema
} from '@chronograph/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { inquiries } from '../db/schema';
import { assertLinkByUid, insertInquiry, listInquiries } from '../lib/inquiry-service';
import { mapInquiry } from '../lib/temporal-mappers';
import { nowIso } from '../lib/time';

export const inquiryRoutes = new Hono();

inquiryRoutes.get('/', async (c) => {
	const query = inquiryListQuerySchema.parse({
		status: c.req.query('status'),
		subject_uid: c.req.query('subject_uid'),
		subject_kind: c.req.query('subject_kind'),
		trigger_kind: c.req.query('trigger_kind')
	});

	const rows = await listInquiries(query);
	return c.json({ inquiries: rows });
});

inquiryRoutes.post('/', async (c) => {
	const body = createInquirySchema.parse(await c.req.json());
	const row = await insertInquiry(body);
	return c.json(mapInquiry(row), 201);
});

inquiryRoutes.get('/:uid', async (c) => {
	const uid = c.req.param('uid');
	const [row] = await db.select().from(inquiries).where(eq(inquiries.uid, uid));
	if (!row) return c.json({ error: 'Inquiry not found' }, 404);
	return c.json(mapInquiry(row));
});

inquiryRoutes.post('/:uid/answer', async (c) => {
	const uid = c.req.param('uid');
	const body = answerInquirySchema.parse(await c.req.json());
	const ts = nowIso();

	const [existing] = await db.select().from(inquiries).where(eq(inquiries.uid, uid));
	if (!existing) return c.json({ error: 'Inquiry not found' }, 404);
	if (existing.status !== 'open') return c.json({ error: 'Inquiry is not open' }, 409);

	const status = body.response_kind === 'defer' ? 'deferred' : 'answered';

	await db
		.update(inquiries)
		.set({
			userResponseKind: body.response_kind,
			userResponseText: body.response_text ?? null,
			status,
			updatedAt: ts
		})
		.where(eq(inquiries.uid, uid));

	if (body.response_kind === 'accept' && existing.subjectKind === 'link') {
		await assertLinkByUid(existing.subjectUid, body.assert_link_label ?? null);
	}

	const [row] = await db.select().from(inquiries).where(eq(inquiries.uid, uid));
	return c.json(mapInquiry(row!));
});

inquiryRoutes.post('/:uid/defer', async (c) => {
	const uid = c.req.param('uid');
	const ts = nowIso();

	const result = await db
		.update(inquiries)
		.set({ status: 'deferred', userResponseKind: 'defer', updatedAt: ts })
		.where(and(eq(inquiries.uid, uid), eq(inquiries.status, 'open')));

	if (result.changes === 0) return c.json({ error: 'Inquiry not found or not open' }, 404);

	const [row] = await db.select().from(inquiries).where(eq(inquiries.uid, uid));
	return c.json(mapInquiry(row!));
});

inquiryRoutes.post('/:uid/dismiss', async (c) => {
	const uid = c.req.param('uid');
	const ts = nowIso();

	const result = await db
		.update(inquiries)
		.set({ status: 'dismissed', userResponseKind: 'reject', updatedAt: ts })
		.where(and(eq(inquiries.uid, uid), eq(inquiries.status, 'open')));

	if (result.changes === 0) return c.json({ error: 'Inquiry not found or not open' }, 404);

	const [row] = await db.select().from(inquiries).where(eq(inquiries.uid, uid));
	return c.json(mapInquiry(row!));
});
