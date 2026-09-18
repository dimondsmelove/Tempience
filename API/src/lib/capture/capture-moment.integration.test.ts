import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { SCOPES_ONLY_SCHEMA_SQL } from '../test/scopes-only-schema';

describe('captureMoment integration', () => {
	let dbDir: string;

	beforeAll(() => {
		dbDir = mkdtempSync(join(tmpdir(), 'chronograph-capture-'));
		process.env.DATABASE_URL = `file:${join(dbDir, 'test.db')}`;
		const sqlite = new Database(process.env.DATABASE_URL.replace(/^file:/, ''));
		sqlite.exec(SCOPES_ONLY_SCHEMA_SQL);
		sqlite.close();
	});

	beforeEach(() => {
		vi.resetModules();
	});

	afterAll(() => {
		rmSync(dbDir, { recursive: true, force: true });
	});

	it('creates one trace with three memberships and a new continuity (broken-leg)', async () => {
		const { db } = await import('../../db/client');
		const { captureMoment } = await import('./capture-moment');
		const { scopePhases, scopes } = await import('../../db/schema');
		const ts = '2026-07-14T11:30:00.000Z';

		await db.insert(scopes).values([
			{
				uid: 'c-recovery',
				kind: 'continuity',
				name: 'восстановление',
				parentScopeUid: null,
				startedAt: ts,
				endedAt: null,
				note: null,
				status: 'active',
				supersededByUid: null,
				facet: 'condition',
				ownerUid: 'local-user',
				spaceUid: 'personal',
				createdAt: ts,
				updatedAt: ts
			},
			{
				uid: 'c-friends',
				kind: 'continuity',
				name: 'друзья / Черногория',
				parentScopeUid: null,
				startedAt: ts,
				endedAt: null,
				note: null,
				status: 'active',
				supersededByUid: null,
				facet: 'relationship',
				ownerUid: 'local-user',
				spaceUid: 'personal',
				createdAt: ts,
				updatedAt: ts
			},
			{
				uid: 'c-region',
				kind: 'continuity',
				name: 'ситуация в регионе',
				parentScopeUid: null,
				startedAt: ts,
				endedAt: null,
				note: null,
				status: 'active',
				supersededByUid: null,
				facet: 'thread',
				ownerUid: 'local-user',
				spaceUid: 'personal',
				createdAt: ts,
				updatedAt: ts
			}
		]);

		for (const continuityUid of ['c-recovery', 'c-friends', 'c-region']) {
			await db.insert(scopePhases).values({
				uid: `s-${continuityUid}`,
				continuityUid,
				phase: 'active',
				startAt: ts,
				endAt: null,
				label: continuityUid,
				sortOrder: 0,
				createdAt: ts
			});
		}

		const result = await captureMoment({
			idempotency_key: 'cap-broken-leg-integration',
			trace: {
				timezone: 'Europe/Belgrade',
				about_kind: 'instant',
				about_at: ts,
				hook_text:
					'Лежу дома со сломанной ногой. Пока друзья в Черногории, на фоне тревоги в регионе мысль о переезде стала направлением.',
				hook_kind: 'pulse',
				relation: 'observe'
			},
			scopes: [
				{ mode: 'existing', continuity_uid: 'c-recovery' },
				{ mode: 'existing', continuity_uid: 'c-friends' },
				{ mode: 'existing', continuity_uid: 'c-region' },
				{
					mode: 'create',
					name: 'переезд',
					kind: 'thread',
					initial_segment_label: 'направление внимания'
				}
			]
		});

		expect(result.memberships).toHaveLength(4);
		expect(result.continuities).toHaveLength(4);
		expect(result.trace.hook_text).toContain('сломанной ногой');

		const replay = await captureMoment({
			idempotency_key: 'cap-broken-leg-integration',
			trace: {
				timezone: 'Europe/Belgrade',
				about_kind: 'instant',
				about_at: ts,
				hook_text: 'should not duplicate',
				hook_kind: 'pulse'
			},
			scopes: []
		});

		expect(replay.trace.uid).toBe(result.trace.uid);
		expect(replay.memberships).toHaveLength(4);

		const { scopeTraces } = await import('../../db/schema');
		const bindings = await db
			.select()
			.from(scopeTraces)
			.where(eq(scopeTraces.traceUid, result.trace.uid));
		expect(bindings).toHaveLength(4);

		const scopeRows = await db.select().from(scopes);
		expect(scopeRows.length).toBeGreaterThanOrEqual(4);
		const moveScope = scopeRows.find((row) => row.name === 'переезд');
		expect(moveScope?.kind).toBe('continuity');
		expect(moveScope?.facet).toBe('thread');
	});
});
