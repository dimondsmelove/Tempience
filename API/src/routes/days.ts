import { dayContextQuerySchema } from '@chronograph/shared';
import { Hono } from 'hono';
import { buildDayContext } from '../lib/day/build-day-context';

export const dayRoutes = new Hono();

dayRoutes.get('/:date/context', async (c) => {
	const date = c.req.param('date');
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return c.json({ error: 'date must be YYYY-MM-DD' }, 400);
	}
	const query = dayContextQuerySchema.parse({ timezone: c.req.query('timezone') });
	return c.json(await buildDayContext(date, query));
});
