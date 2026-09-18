import type { ContinuitySemanticTag, SemanticTagInput } from '@chronograph/shared';
import { and, asc, eq } from 'drizzle-orm';
import { db, sqlite } from '../../db/client';
import { continuitySemanticTags, scopePhases, scopes } from '../../db/schema';
import { mapContinuitySemanticTag } from '../temporal-mappers';
import { normalizeLexeme } from './normalize-lexeme';
import { indexContinuityProfile } from '../search/lexical-search';
import { newUid, nowIso } from '../time';

const compileProfileText = (
	name: string,
	tags: ContinuitySemanticTag[],
	segmentLabels: string[] = []
): string => [name, ...tags.map((tag) => tag.tag), ...segmentLabels].filter(Boolean).join(' ');

export const listSemanticTags = async (continuityUid: string) => {
	const rows = await db
		.select()
		.from(continuitySemanticTags)
		.where(eq(continuitySemanticTags.continuityUid, continuityUid))
		.orderBy(asc(continuitySemanticTags.createdAt));
	return rows.map(mapContinuitySemanticTag);
};

export const replaceSemanticTags = async (
	continuityUid: string,
	inputTags: SemanticTagInput[]
) => {
	const [scope] = await db
		.select()
		.from(scopes)
		.where(and(eq(scopes.uid, continuityUid), eq(scopes.kind, 'continuity')));
	if (!scope) throw new Error('Continuity not found');

	const deduped = new Map<string, SemanticTagInput>();
	for (const tag of inputTags) {
		const normalized = normalizeLexeme(tag.tag);
		if (!normalized) continue;
		deduped.set(`${tag.dimension}:${normalized}`, {
			...tag,
			tag: normalized
		});
	}

	const ts = nowIso();
	await db.delete(continuitySemanticTags).where(eq(continuitySemanticTags.continuityUid, continuityUid));

	const rows = [...deduped.values()].slice(0, 30).map((tag) => ({
		uid: newUid(),
		continuityUid,
		tag: tag.tag,
		dimension: tag.dimension,
		source: tag.source,
		createdAt: ts
	}));

	if (rows.length > 0) {
		await db.insert(continuitySemanticTags).values(rows);
	}

	const mapped = rows.map(mapContinuitySemanticTag);
	const segmentRows = await db
		.select()
		.from(scopePhases)
		.where(eq(scopePhases.continuityUid, continuityUid));
	const profileText = compileProfileText(
		scope.name,
		mapped,
		segmentRows.map((row) => row.label).filter((label): label is string => Boolean(label))
	);
	indexContinuityProfile(sqlite, continuityUid, profileText);

	await db.update(scopes).set({ updatedAt: ts }).where(eq(scopes.uid, continuityUid));

	return { tags: mapped, profile_text: profileText };
};
