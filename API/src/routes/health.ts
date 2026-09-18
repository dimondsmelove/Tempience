import { Hono } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) =>
	c.json({
		ok: true,
		service: 'chronograph-api',
		version: '0.0.1'
	})
);
