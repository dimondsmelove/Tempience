import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ZodError } from 'zod';
import { api } from './routes';

const app = new Hono();

app.use(
	'*',
	cors({
		origin: '*',
		allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
	})
);

app.route('/api/v1', api);

app.onError((err, c) => {
	if (err instanceof ZodError) {
		return c.json({ error: 'Validation failed', details: err.flatten() }, 400);
	}
	console.error(err);
	return c.json({ error: err.message || 'Internal error' }, 500);
});

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
	console.log(`Chronograph API http://localhost:${port}`);
});
