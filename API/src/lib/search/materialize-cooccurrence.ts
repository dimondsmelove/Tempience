import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { listScopeUidsForTrace } from '../scope/scope-trace-bindings';
import { threadCooccurrence } from '../../db/schema';
import { newUid, nowIso } from '../time';

export const materializeCooccurrenceForTrace = async (traceUid: string): Promise<void> => {
	const continuityUids = listScopeUidsForTrace(traceUid);
	if (continuityUids.length < 2) return;

	const ts = nowIso();
	for (let i = 0; i < continuityUids.length; i += 1) {
		for (let j = i + 1; j < continuityUids.length; j += 1) {
			const a = continuityUids[i]!;
			const b = continuityUids[j]!;
			const [threadAUid, threadBUid] = a < b ? [a, b] : [b, a];
			const existing = await db
				.select()
				.from(threadCooccurrence)
				.where(
					and(
						eq(threadCooccurrence.threadAUid, threadAUid),
						eq(threadCooccurrence.threadBUid, threadBUid)
					)
				);
			if (existing.length > 0) {
				const row = existing[0]!;
				const bridgeUids = new Set(
					JSON.parse(row.bridgeTraceUidsJson || '[]') as string[]
				);
				bridgeUids.add(traceUid);
				await db
					.update(threadCooccurrence)
					.set({
						intersectionCount: row.intersectionCount + 1,
						lastAt: ts,
						bridgeTraceUidsJson: JSON.stringify([...bridgeUids].slice(-20))
					})
					.where(eq(threadCooccurrence.uid, row.uid));
				continue;
			}
			await db.insert(threadCooccurrence).values({
				uid: newUid(),
				threadAUid,
				threadBUid,
				intersectionCount: 1,
				lastAt: ts,
				bridgeTraceUidsJson: JSON.stringify([traceUid])
			});
		}
	}
};
