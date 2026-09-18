import type { LexicalSearchResult, SearchCluster, SearchHit } from '@chronograph/shared';
import { and, asc, eq, inArray, isNull, like, or } from 'drizzle-orm';
import type Database from 'better-sqlite3';
import { db } from '../../db/client';
import { continuitySemanticTags, scopes, threadCooccurrence, traces } from '../../db/schema';
import { listScopeUidsForTraces } from '../scope/scope-trace-bindings';
import { scopeToContinuity } from '../scope/scope-mappers';
import { mapTrace } from '../temporal-mappers';
import { normalizeLexeme, tokenizeQuery } from '../semantic/normalize-lexeme';

const scoreTag = 5;
const scoreTrace = 2;

const traceTitle = (hookText: string, word: string | null | undefined): string =>
	word?.trim() || hookText.trim().slice(0, 80);

export const runLexicalSearch = async (
	query: string,
	limit = 20,
	ragEnabled = false
): Promise<LexicalSearchResult> => {
	const tokens = tokenizeQuery(query);
	const lexeme = normalizeLexeme(query);
	if (tokens.length === 0) {
		return { query, clusters: [], bridges: [], rag_enabled: ragEnabled };
	}

	const tagRows = await db
		.select()
		.from(continuitySemanticTags)
		.where(
			or(
				...tokens.map((token) => like(continuitySemanticTags.tag, `%${token}%`)),
				like(continuitySemanticTags.tag, `%${lexeme}%`)
			)
		);

	const traceRows = await db
		.select()
		.from(traces)
		.where(
			and(
				isNull(traces.retractedAt),
				or(
					...tokens.map((token) => like(traces.hookText, `%${token}%`)),
					like(traces.hookText, `%${lexeme}%`),
					...tokens.map((token) => like(traces.word, `%${token}%`))
				)
			)
		)
		.orderBy(asc(traces.capturedAt))
		.limit(limit * 3);

	const continuityUids = new Set<string>(tagRows.map((row) => row.continuityUid));
	const traceMembership =
		traceRows.length > 0
			? listScopeUidsForTraces(traceRows.map((row) => row.uid))
			: new Map<string, string[]>();

	for (const scopeUidList of traceMembership.values()) {
		for (const scopeUid of scopeUidList) continuityUids.add(scopeUid);
	}

	const continuityRows =
		continuityUids.size > 0
			? await db
					.select()
					.from(scopes)
					.where(
						and(
							inArray(scopes.uid, [...continuityUids]),
							eq(scopes.kind, 'continuity')
						)
					)
			: [];

	const continuityByUid = new Map(continuityRows.map((row) => [row.uid, scopeToContinuity(row)]));

	const clusterMap = new Map<string | null, SearchCluster>();

	const ensureCluster = (uid: string | null): SearchCluster => {
		const existing = clusterMap.get(uid);
		if (existing) return existing;
		const created: SearchCluster = {
			continuity_uid: uid,
			continuity_name: uid ? (continuityByUid.get(uid)?.name ?? null) : null,
			hits: []
		};
		clusterMap.set(uid, created);
		return created;
	};

	for (const tag of tagRows) {
		const cluster = ensureCluster(tag.continuityUid);
		const hit: SearchHit = {
			kind: 'continuity',
			uid: tag.continuityUid,
			title: continuityByUid.get(tag.continuityUid)?.name ?? tag.tag,
			subtitle: tag.tag,
			continuity_uid: tag.continuityUid,
			route: { lens_preset: 'thread-recall', continuity_uid: tag.continuityUid },
			why: [{ signal: 'exact_tag_match', weight: scoreTag, detail: tag.tag }],
			score: scoreTag
		};
		cluster.hits.push(hit);
	}

	for (const row of traceRows) {
		const mapped = mapTrace(row);
		const memberships = traceMembership.get(row.uid) ?? [];
		const targets = memberships.length > 0 ? memberships : [null];
		for (const continuityUid of targets) {
			const cluster = ensureCluster(continuityUid);
			const hit: SearchHit = {
				kind: 'trace',
				uid: row.uid,
				title: traceTitle(mapped.hook_text, mapped.word),
				subtitle: mapped.hook_text,
				continuity_uid: continuityUid ?? undefined,
				route: {
					lens_preset: 'orient-now',
					trace_uid: row.uid,
					continuity_uid: continuityUid ?? undefined
				},
				why: [{ signal: 'trace_text', weight: scoreTrace, detail: mapped.hook_text.slice(0, 120) }],
				score: scoreTrace
			};
			cluster.hits.push(hit);
		}
	}

	const bridges = await db.select().from(threadCooccurrence).limit(20);

	const lexemeBridges = tokens.flatMap((token) => {
		const matches = tagRows.filter((row) => normalizeLexeme(row.tag).includes(token));
		const uids = [...new Set(matches.map((row) => row.continuityUid))];
		if (uids.length < 2) return [];
		const co = bridges.find(
			(row) => uids.includes(row.threadAUid) && uids.includes(row.threadBUid)
		);
		return [
			{
				lexeme: token,
				continuity_uids: uids,
				kind: co && co.intersectionCount >= 2 ? ('resonant' as const) : ('homonym' as const),
				intersection_count: co?.intersectionCount ?? 0
			}
		];
	});

	const clusters = [...clusterMap.values()]
		.map((cluster) => ({
			...cluster,
			hits: cluster.hits
				.sort((a, b) => b.score - a.score)
				.slice(0, limit)
		}))
		.filter((cluster) => cluster.hits.length > 0)
		.sort((a, b) => (b.hits[0]?.score ?? 0) - (a.hits[0]?.score ?? 0));

	return {
		query,
		clusters,
		bridges: lexemeBridges,
		rag_enabled: ragEnabled
	};
};

export const indexTraceDocument = (sqlite: Database.Database, traceUid: string): void => {
	const row = sqlite
		.prepare(
			`SELECT uid, hook_text, word FROM traces WHERE uid = ? AND retracted_at IS NULL`
		)
		.get(traceUid) as { uid: string; hook_text: string; word: string | null } | undefined;
	if (!row) return;
	const body = `${row.word ?? ''} ${row.hook_text}`.trim();
	sqlite
		.prepare(
			`INSERT INTO search_documents(doc_uid, doc_kind, continuity_uid, body)
       VALUES (?, 'trace', NULL, ?)
       ON CONFLICT(doc_uid) DO UPDATE SET body = excluded.body`
		)
		.run(row.uid, body);
};

export const indexContinuityProfile = (
	sqlite: Database.Database,
	continuityUid: string,
	profileText: string
): void => {
	sqlite
		.prepare(
			`INSERT INTO search_documents(doc_uid, doc_kind, continuity_uid, body)
       VALUES (?, 'continuity', ?, ?)
       ON CONFLICT(doc_uid) DO UPDATE SET body = excluded.body, continuity_uid = excluded.continuity_uid`
		)
		.run(`continuity:${continuityUid}`, continuityUid, profileText);
};
