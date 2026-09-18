import { inboxHooksQuerySchema } from '@chronograph/shared';
import { Hono } from 'hono';
import { buildInboxHooks } from '../lib/inbox/build-inbox-hooks';

export const inboxRoutes = new Hono();

inboxRoutes.get('/hooks', async (c) => {
	const query = inboxHooksQuerySchema.parse({
		since: c.req.query('since') || undefined,
		state: c.req.query('state') ?? 'needs',
		limit: c.req.query('limit') ?? 50
	});

	const result = await buildInboxHooks(query);
	return c.json(result);
});
