import type { Scope, ScopeListQuery } from '@chronograph/shared';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopes } from '../../db/schema';
import { mapScope } from './scope-mappers';

export const listScopes = async (query: ScopeListQuery = {}): Promise<Scope[]> => {
	const conditions = [];
	if (query.kind) conditions.push(eq(scopes.kind, query.kind));
	if (query.parent_scope_uid) conditions.push(eq(scopes.parentScopeUid, query.parent_scope_uid));
	if (query.status) conditions.push(eq(scopes.status, query.status));

	const rows = await db
		.select()
		.from(scopes)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(asc(scopes.kind), asc(scopes.name));

	return rows.map(mapScope);
};
