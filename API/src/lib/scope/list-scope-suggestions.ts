import type { Continuity } from '@chronograph/shared';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopeTraces, scopes, traces } from '../../db/schema';
import { scopeToContinuity } from './scope-mappers';

export const listScopeSuggestions = async (limit = 5): Promise<Continuity[]> => {
	const rows = await db
		.select({
			scopeUid: scopeTraces.scopeUid,
			lastAt: sql<string>`max(${traces.capturedAt})`.as('last_at')
		})
		.from(scopeTraces)
		.innerJoin(traces, eq(scopeTraces.traceUid, traces.uid))
		.groupBy(scopeTraces.scopeUid)
		.orderBy(desc(sql`last_at`))
		.limit(limit);

	const uids = rows.map((r) => r.scopeUid);
	if (uids.length === 0) return [];

	const scopeRows = await db
		.select()
		.from(scopes)
		.where(and(inArray(scopes.uid, uids), eq(scopes.kind, 'continuity')));
	const byUid = new Map(scopeRows.map((r) => [r.uid, r]));
	return uids
		.map((uid) => byUid.get(uid))
		.filter((r): r is NonNullable<typeof r> => Boolean(r))
		.map(scopeToContinuity) as Continuity[];
};
