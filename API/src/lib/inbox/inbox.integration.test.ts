import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SCOPES_ONLY_SCHEMA_SQL } from '../test/scopes-only-schema';

describe('inbox + enrich integration', () => {
	let dbDir: string;

	beforeAll(() => {
		dbDir = mkdtempSync(join(tmpdir(), 'chronograph-inbox-'));
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

	it('lists bare hook then scoped after membership enrich', async () => {
		const { db } = await import('../../db/client');
		const { captureMoment } = await import('../capture/capture-moment');
		const { buildInboxHooks } = await import('../inbox/build-inbox-hooks');
		const { assertTraceMemberships } = await import('../enrich/assert-trace-memberships');
		const { scopes } = await import('../../db/schema');

		await db.insert(scopes).values({
			uid: 'c-tech',
			kind: 'continuity',
			name: 'техника',
			parentScopeUid: null,
			startedAt: '2026-07-16T10:00:00.000Z',
			endedAt: null,
			note: null,
			status: 'active',
			supersededByUid: null,
			facet: 'thread',
			ownerUid: 'local-user',
			spaceUid: 'personal',
			createdAt: '2026-07-16T10:00:00.000Z',
			updatedAt: '2026-07-16T10:00:00.000Z'
		});

		const captured = captureMoment({
			idempotency_key: 'hub-arrival',
			trace: {
				timezone: 'Europe/Moscow',
				about_kind: 'instant',
				about_at: '2026-07-16T11:05:00.000Z',
				hook_text: 'Приехал USB-хаб. Вторая попытка доставки.',
				hook_kind: 'pulse',
				relation: 'observe'
			},
			scopes: []
		});

		const bareInbox = await buildInboxHooks({
			since: '2026-07-16T00:00:00.000Z',
			state: 'needs',
			limit: 10
		});
		expect(bareInbox.hooks).toHaveLength(1);
		expect(bareInbox.hooks[0]?.enrichment_state).toBe('bare');

		assertTraceMemberships(captured.trace.uid, {
			refs: [{ mode: 'existing', continuity_uid: 'c-tech' }],
			primary_continuity_uid: 'c-tech'
		});

		const scopedInbox = await buildInboxHooks({
			since: '2026-07-16T00:00:00.000Z',
			state: 'needs',
			limit: 10
		});
		expect(scopedInbox.hooks).toHaveLength(1);
		expect(scopedInbox.hooks[0]?.enrichment_state).toBe('scoped');
	});
});
