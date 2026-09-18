import { lexicalSearchQuerySchema } from '@chronograph/shared';
import { Hono } from 'hono';
import { runLexicalSearch } from '../lib/search/lexical-search';

export const searchRoutes = new Hono();

const ragEnabled = (): boolean => process.env.RAG_ENABLED === 'true';

searchRoutes.post('/lexical', async (c) => {
	const body = lexicalSearchQuerySchema.parse(await c.req.json());
	return c.json(await runLexicalSearch(body.q, body.limit, ragEnabled()));
});

searchRoutes.post('/insights', async (c) => {
	const body = lexicalSearchQuerySchema.parse(await c.req.json());
	// PKG-9b: hybrid rerank when RAG on; v1 returns lexical path with flag
	return c.json(await runLexicalSearch(body.q, body.limit, ragEnabled()));
});
