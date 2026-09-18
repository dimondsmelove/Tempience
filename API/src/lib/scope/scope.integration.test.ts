import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCOPES_ONLY_SCHEMA_SQL } from '../test/scopes-only-schema';

describe('scope context integration', () => {
	let dbDir: string;

	beforeAll(() => {
		dbDir = mkdtempSync(join(tmpdir(), 'chronograph-scope-'));
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

	it('S2: one trace appears once in each of three scope contexts', async () => {
		const { db } = await import('../../db/client');
		const { buildScopeContext } = await import('./build-scope-context');
		const { scopeTraces, scopes, traces } = await import('../../db/schema');

		const ts = '2026-07-16T12:00:00.000Z';

		await db.insert(scopes).values([
			{
				uid: 'c-family',
				kind: 'continuity',
				name: 'Семья',
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
				uid: 't-process',
				kind: 'process',
				name: 'Восстановление отношений',
				parentScopeUid: 'c-family',
				startedAt: ts,
				endedAt: null,
				note: null,
				status: 'active',
				supersededByUid: null,
				facet: null,
				ownerUid: 'local-user',
				spaceUid: 'personal',
				createdAt: ts,
				updatedAt: ts
			},
			{
				uid: 'p-july',
				kind: 'project',
				name: 'Отпуск июль 2026',
				parentScopeUid: null,
				startedAt: null,
				endedAt: null,
				note: null,
				status: 'active',
				supersededByUid: null,
				facet: null,
				ownerUid: 'local-user',
				spaceUid: 'personal',
				createdAt: ts,
				updatedAt: ts
			},
			{
				uid: 't-project',
				kind: 'task',
				name: 'Отпуск июль 2026',
				parentScopeUid: 'p-july',
				startedAt: ts,
				endedAt: null,
				note: null,
				status: 'planned',
				supersededByUid: null,
				facet: null,
				ownerUid: 'local-user',
				spaceUid: 'personal',
				createdAt: ts,
				updatedAt: ts
			}
		]);

		await db.insert(traces).values({
			uid: 'trace-dinner',
			capturedAt: ts,
			timezone: 'Europe/Moscow',
			aboutKind: 'instant',
			aboutAt: ts,
			aboutStart: null,
			aboutEnd: null,
			aboutTraceUid: null,
			hookText: 'photo family dinner',
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

		await db.insert(scopeTraces).values([
			{ scopeUid: 'c-family', traceUid: 'trace-dinner', createdAt: ts },
			{ scopeUid: 't-process', traceUid: 'trace-dinner', createdAt: ts },
			{ scopeUid: 't-project', traceUid: 'trace-dinner', createdAt: ts }
		]);

		const viewTime = '2026-12-31T00:00:00.000Z';
		const family = await buildScopeContext('continuity', 'c-family', {
			lens: 'scope-card',
			trace_limit: 50,
			view_time: viewTime
		});
		const processCtx = await buildScopeContext('process', 't-process', {
			lens: 'scope-card',
			trace_limit: 50,
			view_time: viewTime
		});
		const projectCtx = await buildScopeContext('project', 'p-july', {
			lens: 'scope-card',
			trace_limit: 50,
			view_time: viewTime
		});

		expect(family?.traces).toHaveLength(1);
		expect(processCtx?.traces).toHaveLength(1);
		expect(projectCtx?.traces).toHaveLength(1);
		expect(family?.traces[0]?.trace.uid).toBe('trace-dinner');
		expect(processCtx?.traces[0]?.trace.uid).toBe('trace-dinner');
		expect(projectCtx?.traces[0]?.trace.uid).toBe('trace-dinner');
		expect(family?.projection_meta.dedupe_applied).toBe(true);
	});

	it('S1: unscoped trace excluded from scope-card until membership', async () => {
		const { db } = await import('../../db/client');
		const { buildScopeContext } = await import('./build-scope-context');
		const { buildInboxHooks } = await import('../inbox/build-inbox-hooks');
		const { scopes, traces } = await import('../../db/schema');

		const ts = '2026-07-16T08:00:00.000Z';
		await db.insert(scopes).values({
			uid: 'c-health',
			kind: 'continuity',
			name: 'Здоровье',
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
		});
		await db.insert(traces).values({
			uid: 'trace-unscoped',
			capturedAt: ts,
			timezone: 'Europe/Moscow',
			aboutKind: 'instant',
			aboutAt: ts,
			hookText: 'тревожно, не сплю',
			hookKind: 'pulse',
			source: 'capture',
			createdAt: ts
		});

		const ctx = await buildScopeContext('continuity', 'c-health', {
			lens: 'scope-card',
			trace_limit: 50,
			view_time: '2026-12-31T00:00:00.000Z'
		});
		expect(ctx?.traces).toHaveLength(0);

		const inbox = await buildInboxHooks({ since: '2026-07-01T00:00:00.000Z', state: 'bare', limit: 10 });
		expect(inbox.hooks.some((h) => h.trace.uid === 'trace-unscoped')).toBe(true);
	});

	it('S4: completed continuity stays completed with revisit trace', async () => {
		const { db } = await import('../../db/client');
		const { buildScopeContext } = await import('./build-scope-context');
		const { scopeTraces, scopes, traces } = await import('../../db/schema');

		const ts = '2021-12-31T00:00:00.000Z';
		await db.insert(scopes).values({
			uid: 'c-kazan',
			kind: 'continuity',
			name: 'Жизнь в Казани',
			parentScopeUid: null,
			startedAt: '2020-01-01T00:00:00.000Z',
			endedAt: ts,
			note: null,
			status: 'completed',
			supersededByUid: null,
			facet: 'thread',
			ownerUid: 'local-user',
			spaceUid: 'personal',
			createdAt: ts,
			updatedAt: ts
		});
		await db.insert(traces).values({
			uid: 'trace-revisit',
			capturedAt: '2026-07-16T10:00:00.000Z',
			timezone: 'Europe/Moscow',
			aboutKind: 'instant',
			aboutAt: '2026-07-16T10:00:00.000Z',
			hookText: 'набережная, странное чувство',
			hookKind: 'revisit',
			relation: 'revisit',
			source: 'capture',
			createdAt: '2026-07-16T10:00:00.000Z'
		});
		await db.insert(scopeTraces).values({
			scopeUid: 'c-kazan',
			traceUid: 'trace-revisit',
			createdAt: '2026-07-16T10:00:00.000Z'
		});

		const ctx = await buildScopeContext('continuity', 'c-kazan', {
			lens: 'scope-card',
			trace_limit: 50,
			view_time: '2026-12-31T00:00:00.000Z'
		});
		expect(ctx?.scope.status).toBe('completed');
		expect(ctx?.traces).toHaveLength(1);
	});

	it('S3: wrong scope fork — trace stays on old process, not new', async () => {
		const { db } = await import('../../db/client');
		const { buildScopeContext } = await import('./build-scope-context');
		const { scopeTraces, scopes, traces } = await import('../../db/schema');

		const ts = '2026-07-16T12:00:00.000Z';
		await db.insert(scopes).values([
			{
				uid: 't-spine',
				kind: 'process',
				name: 'Лечение спины',
				parentScopeUid: null,
				startedAt: ts,
				endedAt: null,
				note: null,
				status: 'active',
				supersededByUid: 't-knee',
				facet: null,
				ownerUid: 'local-user',
				spaceUid: 'personal',
				createdAt: ts,
				updatedAt: ts
			},
			{
				uid: 't-knee',
				kind: 'process',
				name: 'Лечение колена',
				parentScopeUid: null,
				startedAt: ts,
				endedAt: null,
				note: null,
				status: 'active',
				supersededByUid: null,
				facet: null,
				ownerUid: 'local-user',
				spaceUid: 'personal',
				createdAt: ts,
				updatedAt: ts
			}
		]);
		await db.insert(traces).values({
			uid: 'trace-spine',
			capturedAt: ts,
			timezone: 'Europe/Moscow',
			aboutKind: 'instant',
			aboutAt: ts,
			hookText: 'болит спина',
			hookKind: 'pulse',
			source: 'capture',
			createdAt: ts
		});
		await db.insert(scopeTraces).values({
			scopeUid: 't-spine',
			traceUid: 'trace-spine',
			createdAt: ts
		});

		const oldCtx = await buildScopeContext('process', 't-spine', {
			lens: 'scope-card',
			trace_limit: 50,
			view_time: '2026-12-31T00:00:00.000Z'
		});
		const newCtx = await buildScopeContext('process', 't-knee', {
			lens: 'scope-card',
			trace_limit: 50,
			view_time: '2026-12-31T00:00:00.000Z'
		});
		expect(oldCtx?.traces).toHaveLength(1);
		expect(newCtx?.traces).toHaveLength(0);
	});

	it('S5: period closure v2 does not mutate trace set', async () => {
		const { db } = await import('../../db/client');
		const { buildScopeContext } = await import('./build-scope-context');
		const { scopeTraces, scopes, traces } = await import('../../db/schema');

		const ts = '2026-07-16T12:00:00.000Z';
		await db.insert(scopes).values({
			uid: 't-burnout',
			kind: 'process',
			name: 'Восстановление после выгорания',
			parentScopeUid: null,
			startedAt: ts,
			endedAt: null,
			note: null,
			status: 'active',
			supersededByUid: null,
			facet: null,
			ownerUid: 'local-user',
			spaceUid: 'personal',
			createdAt: ts,
			updatedAt: ts
		});
		const traceUids = ['tr-1', 'tr-2'];
		for (const uid of traceUids) {
			await db.insert(traces).values({
				uid,
				capturedAt: ts,
				timezone: 'Europe/Moscow',
				aboutKind: 'instant',
				aboutAt: ts,
				hookText: `trace ${uid}`,
				hookKind: 'pulse',
				source: 'capture',
				createdAt: ts
			});
			await db.insert(scopeTraces).values({
				scopeUid: 't-burnout',
				traceUid: uid,
				createdAt: ts
			});
		}

		const ctx = await buildScopeContext('process', 't-burnout', {
			lens: 'scope-card',
			trace_limit: 50,
			view_time: '2026-12-31T00:00:00.000Z'
		});
		expect(ctx?.traces).toHaveLength(2);
		expect(ctx?.closures).toEqual([]);
	});
});
