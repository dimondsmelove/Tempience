import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCOPES_ONLY_SCHEMA_SQL } from '../test/scopes-only-schema';

describe('day context integration', () => {
	let dbDir: string;

	beforeAll(() => {
		dbDir = mkdtempSync(join(tmpdir(), 'chronograph-day-'));
		process.env.DATABASE_URL = `file:${join(dbDir, 'test.db')}`;
		const sqlite = new Database(process.env.DATABASE_URL.replace(/^file:/, ''));
		sqlite.exec(SCOPES_ONLY_SCHEMA_SQL);
		sqlite.close();
	});

	beforeEach(() => vi.resetModules());
	afterAll(() => rmSync(dbDir, { recursive: true, force: true }));

	it('returns traces captured on local day', async () => {
		const { db } = await import('../../db/client');
		const { buildDayContext } = await import('./build-day-context');
		const { scopeTraces, scopes, traces } = await import('../../db/schema');

		const ts = '2026-07-16T11:00:00.000Z';
		await db.insert(scopes).values({
			uid: 'c1',
			kind: 'continuity',
			name: 'техника',
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
		});
		await db.insert(traces).values({
			uid: 't1',
			capturedAt: ts,
			timezone: 'Europe/Moscow',
			aboutKind: 'instant',
			aboutAt: ts,
			aboutStart: null,
			aboutEnd: null,
			aboutTraceUid: null,
			hookText: 'USB hub',
			hookKind: 'pulse',
			relation: null,
			valence: null,
			word: null,
			taskRef: null,
			idempotencyKey: null,
			source: 'capture',
			retractedAt: null,
			createdAt: ts
		});
		await db.insert(scopeTraces).values({
			scopeUid: 'c1',
			traceUid: 't1',
			createdAt: ts
		});

		const ctx = await buildDayContext('2026-07-16', { timezone: 'Europe/Moscow' });
		expect(ctx.traces).toHaveLength(1);
		expect(ctx.scope_touches).toHaveLength(1);
		expect(ctx.scope_touches[0]?.name).toBe('техника');
	});
});
