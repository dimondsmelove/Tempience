import { upsertSemanticTagsSchema } from '@chronograph/shared';
import { Hono } from 'hono';
import { listSemanticTags, replaceSemanticTags } from '../lib/semantic/tag-service';

export const semanticRoutes = new Hono();

semanticRoutes.get('/continuities/:uid/tags', async (c) => {
	const continuityUid = c.req.param('uid');
	try {
		const tags = await listSemanticTags(continuityUid);
		const profile_text = tags.map((tag) => tag.tag).join(' ');
		return c.json({ tags, profile_text });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed';
		if (message === 'Continuity not found') return c.json({ error: message }, 404);
		throw err;
	}
});

semanticRoutes.put('/continuities/:uid/tags', async (c) => {
	const continuityUid = c.req.param('uid');
	const body = upsertSemanticTagsSchema.parse(await c.req.json());
	try {
		return c.json(await replaceSemanticTags(continuityUid, body.tags));
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed';
		if (message === 'Continuity not found') return c.json({ error: message }, 404);
		throw err;
	}
});
