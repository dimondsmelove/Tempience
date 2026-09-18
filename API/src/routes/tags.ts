import { createTagSchema, updateTagSchema } from '@chronograph/shared';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { tags } from '../db/schema';
import { mapTag } from '../lib/mappers';
import { newUid, nowIso } from '../lib/time';

export const tagRoutes = new Hono();

tagRoutes.get('/', async (c) => {
	const rows = await db.select().from(tags).orderBy(asc(tags.name));
	return c.json({ tags: rows.map(mapTag) });
});

tagRoutes.post('/', async (c) => {
	const body = createTagSchema.parse(await c.req.json());
	const row = {
		uid: newUid(),
		name: body.name,
		createdAt: nowIso()
	};
	await db.insert(tags).values(row);
	return c.json(mapTag(row), 201);
});

tagRoutes.patch('/:uid', async (c) => {
	const uid = c.req.param('uid');
	const body = updateTagSchema.parse(await c.req.json());
	const [existing] = await db.select().from(tags).where(eq(tags.uid, uid));
	if (!existing) return c.json({ error: 'Tag not found' }, 404);

	const updated = { ...existing, name: body.name };
	await db.update(tags).set(updated).where(eq(tags.uid, uid));
	return c.json(mapTag(updated));
});

tagRoutes.delete('/:uid', async (c) => {
	const uid = c.req.param('uid');
	const result = await db.delete(tags).where(eq(tags.uid, uid));
	if (result.changes === 0) return c.json({ error: 'Tag not found' }, 404);
	return c.body(null, 204);
});
