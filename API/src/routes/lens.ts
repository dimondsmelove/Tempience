import { BUILTIN_LENS_PRESETS, lensQuerySchema } from '@chronograph/shared';
import { Hono } from 'hono';
import { runLens } from '../lib/lens/run-lens';

export const lensRoutes = new Hono();

lensRoutes.get('/presets', (c) => c.json({ presets: BUILTIN_LENS_PRESETS }));

lensRoutes.post('/run', async (c) => {
	const body = lensQuerySchema.parse(await c.req.json());
	try {
		return c.json(await runLens(body));
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Lens run failed';
		if (message.includes('required')) {
			return c.json({ error: message }, 400);
		}
		if (message === 'Continuity not found') {
			return c.json({ error: message }, 404);
		}
		throw err;
	}
});
