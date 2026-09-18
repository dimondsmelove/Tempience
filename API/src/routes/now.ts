import { nowQuerySchema } from '@chronograph/shared';
import { Hono } from 'hono';
import { buildNowResponse } from '../lib/temporal-runtime/now-service';

export const nowRoutes = new Hono();

nowRoutes.get('/', async (c) => {
	const query = nowQuerySchema.parse({
		at: c.req.query('at'),
		timezone: c.req.query('timezone') ?? 'UTC',
		week_start: c.req.query('week_start'),
		evaluate: c.req.query('evaluate') ?? 'true'
	});

	return c.json(await buildNowResponse(query));
});

nowRoutes.post('/tick', async (c) => {
	const body = nowQuerySchema.parse(await c.req.json().catch(() => ({})));
	return c.json(await buildNowResponse({ ...body, evaluate: true }));
});
