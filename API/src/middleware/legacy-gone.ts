import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';

const REPLACEMENTS: Record<string, string> = {
	areas: '/scopes?kind=project',
	projects: '/scopes?kind=project',
	tasks: '/scopes?kind=task',
	links: '/scopes and POST /traces/:uid/scopes',
	stitches: '/scopes (scope membership)',
	'period-closures': '/scopes?kind=period',
	continuities: '/scopes?kind=continuity',
	attachments: '/scopes?kind=task'
};

export const legacyGone = (resource: string): MiddlewareHandler => {
	const replacement = REPLACEMENTS[resource] ?? '/scopes';
	return async (c) =>
		c.json(
			{
				error: `Legacy API removed: ${resource}`,
				replacement,
				canonical: '/vision/core.md'
			},
			410,
			{
				Link: `<${replacement}>; rel="successor-version"`,
				Deprecation: 'true',
				'X-Legacy-Resource': resource
			}
		);
};

export const mountLegacyGone = (app: Hono, basePath: string, resource: string): void => {
	const router = new Hono();
	router.all('*', legacyGone(resource));
	app.route(basePath, router);
};
