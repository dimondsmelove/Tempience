import { TriplitClient, Schema as S } from '@triplit/client';
import { BTreeKVStore } from '@triplit/db/storage/memory-btree';
import { expect, it } from 'vitest';
import { createBackupRepository } from './Backup/Backup';
import { parseDataSpaceBackup } from './Backup/parse';
import { DATA_SPACES, CANONICAL_DATA_SPACE_ID } from './data-space';
import { createTriplitRepository } from './repository';
import { schema } from './schema';

// Published schema e6b5ed3: five collections, before Kinds and label-only Scope segments.

const legacySchema = S.Collections({
	traces: {
		schema: S.Schema({
			id: S.Id(),
			capturedAt: S.String(),
			timezone: S.String(),
			aboutKind: S.String(),
			aboutAt: S.Optional(S.String()),
			aboutStart: S.Optional(S.String()),
			aboutEnd: S.Optional(S.String()),
			aboutTraceId: S.Optional(S.String()),
			content: S.String(),
			relation: S.Optional(S.String()),
			dataJson: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	scopes: {
		schema: S.Schema({
			id: S.Id(),
			name: S.String(),
			parentScopeId: S.Optional(S.String()),
			definitionId: S.Optional(S.String()),
			startedAt: S.Optional(S.String()),
			endedAt: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	scopeSegments: {
		schema: S.Schema({
			id: S.Id(),
			scopeId: S.String(),
			phase: S.String(),
			startAt: S.Optional(S.String()),
			endAt: S.Optional(S.String()),
			label: S.Optional(S.String()),
			position: S.Number(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	intersections: {
		schema: S.Schema({
			id: S.Id(),
			fromId: S.String(),
			toId: S.String(),
			kind: S.String(),
			context: S.Optional(S.String()),
			isDeleted: S.Boolean(),
			createdAt: S.String(),
			updatedAt: S.String()
		})
	},
	logs: {
		schema: S.Schema({
			id: S.Id(),
			operationId: S.String(),
			entityType: S.String(),
			entityId: S.String(),
			action: S.String(),
			patchJson: S.String(),
			occurredAt: S.String(),
			deviceId: S.String(),
			actor: S.String(),
			cause: S.String()
		})
	}
});

it('upgrades populated pre-Kind storage without dropping old fields and makes form catalogs readable', async () => {
	const storage = new BTreeKVStore();
	const old = new TriplitClient({ schema: legacySchema, storage, autoConnect: false });
	const at = '2026-08-08T10:00:00.000Z';
	await old.insert('traces', {
		id: 'legacy-trace',
		capturedAt: at,
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutAt: at,
		content: 'Preserved record',
		dataJson: '{"preserved":true}',
		isDeleted: false,
		createdAt: at,
		updatedAt: at
	});
	await old.insert('scopes', {
		id: 'legacy-scope',
		name: 'Preserved Scope',
		definitionId: 'legacy-definition',
		isDeleted: false,
		createdAt: at,
		updatedAt: at
	});
	await old.insert('scopeSegments', {
		id: 'legacy-segment',
		scopeId: 'legacy-scope',
		phase: 'legacy-phase',
		position: 0,
		createdAt: at,
		updatedAt: at
	});
	const before = {
		traces: await old.fetch(old.query('traces')),
		scopes: await old.fetch(old.query('scopes')),
		scopeSegments: await old.fetch(old.query('scopeSegments'))
	};
	await old.disconnect();
	const events: string[] = [];
	const current = new TriplitClient({
		schema,
		storage,
		autoConnect: false,
		experimental: {
			onDatabaseInit: (_db, event) => {
				events.push(event.type);
			}
		}
	});
	try {
		await current.ready;
		expect(events).toEqual(['SUCCESS']);
		expect(await current.fetch(current.query('traceKinds'))).toEqual([]);
		expect(await current.fetch(current.query('traceKindVersions'))).toEqual([]);
		expect(await current.fetch(current.query('traces'))).toEqual(before.traces);
		expect(await current.fetch(current.query('scopes'))).toEqual(before.scopes);
		expect(await current.fetch(current.query('scopeSegments'))).toEqual(before.scopeSegments);
		const backup = await createBackupRepository(
			current,
			DATA_SPACES[CANONICAL_DATA_SPACE_ID]
		).export();
		expect(parseDataSpaceBackup(backup)).toEqual(backup);
		expect(backup.collections.traces[0]).toHaveProperty('dataJson', '{"preserved":true}');
		expect(backup.collections.scopes[0]).toHaveProperty('definitionId', 'legacy-definition');
		expect(backup.collections.scopeSegments[0]).toHaveProperty('phase', 'legacy-phase');
		const repo = createTriplitRepository(current);
		const { kind } = await repo.createTraceKind({
			name: 'New Kind after upgrade',
			initialKindV: { dataSchema: { type: 'object', properties: {} } }
		});
		await repo.setTraceKindScopes(kind.id, ['legacy-scope']);
		expect(await repo.listTraceKinds()).toHaveLength(1);
	} finally {
		await current.disconnect();
	}
});
