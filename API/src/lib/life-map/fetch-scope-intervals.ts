import type { ScopeInterval, ScopeKind } from "@chronograph/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { scopePhases, scopes } from "../../db/schema";

export const fetchScopeIntervals = async (
	kind: ScopeKind,
	uid: string
): Promise<ScopeInterval[] | null> => {
	const [scope] = await db.select().from(scopes).where(eq(scopes.uid, uid));
	if (!scope || scope.kind !== kind) return null;

	const phases = await db
		.select()
		.from(scopePhases)
		.where(eq(scopePhases.continuityUid, uid))
		.orderBy(asc(scopePhases.sortOrder));

	if (phases.length > 0) {
		return phases.map((phase) => ({
			start_at: phase.startAt,
			end_at: phase.endAt
		}));
	}

	return [{ start_at: scope.startedAt, end_at: scope.endedAt }];
};
