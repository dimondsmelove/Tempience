import { scopeContextQuerySchema, scopeKindSchema, scopeListQuerySchema } from '@chronograph/shared';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { buildScopeContext } from '../lib/scope/build-scope-context';
import { listScopes } from '../lib/scope/list-scopes';
import { listScopeSuggestions } from '../lib/scope/list-scope-suggestions';

export const scopeRoutes = new Hono();

scopeRoutes.get('/', async (c) => {
	const query = scopeListQuerySchema.parse({
		kind: c.req.query('kind') || undefined,
		parent_scope_uid: c.req.query('parent_scope_uid') || undefined,
		status: c.req.query('status') || undefined
	});
	const scopes = await listScopes(query);
	return c.json({ scopes });
});

scopeRoutes.get('/suggestions', async (c) => {
	const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 5), 1), 20);
	const scopes = await listScopeSuggestions(limit);
	return c.json({ scopes });
});

const scopeViewHandler = async (c: Context) => {
	const kind = scopeKindSchema.parse(c.req.param('kind'));
	const uid = c.req.param('uid');
	if (!uid) return c.json({ error: 'uid required' }, 404);
	const query = scopeContextQuerySchema.parse({
		view_time: c.req.query('view_time'),
		lens: c.req.query('lens'),
		trace_limit: c.req.query('trace_limit')
	});

	const context = await buildScopeContext(kind, uid, query);
	if (!context) return c.json({ error: 'Scope not found' }, 404);
	return c.json(context);
};

scopeRoutes.get('/:kind/:uid/view', scopeViewHandler);
scopeRoutes.get('/:kind/:uid/context', scopeViewHandler);
