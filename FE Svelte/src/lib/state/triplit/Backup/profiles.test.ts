import { TriplitClient, Schema as S } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { createImportedDataSpace } from '../data-space';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { createBackupRepository } from './Backup';
import {
	BACKUP_COLLECTION_PROFILES,
	BACKUP_FORMAT,
	ORIGINAL_BACKUP_COLLECTIONS
} from './constants';
import { parseDataSpaceBackup } from './parse';
import type { BackupCollection, DataSpaceBackup } from './types';

const clients: TriplitClient<never>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

type Properties = Record<string, unknown>;
const without = (properties: Properties, keys: readonly string[]): Properties =>
	Object.fromEntries(Object.entries(properties).filter(([key]) => !keys.includes(key)));

/**
 * The d948e1d schema (PR #27, first published export): fifteen collections, no Scope
 * capture settings, no assessments, and none of the optional fields added since
 * (stated duration, Kind membership provenance, the Trace encoding marker).
 */
const originalSchema = S.Collections({
	uiThemes: schema.uiThemes,
	uiAppearance: schema.uiAppearance,
	traceKinds: schema.traceKinds,
	traceKindVersions: schema.traceKindVersions,
	traces: {
		schema: S.Schema(
			without(schema.traces.schema.properties, ['statedDuration', 'encoding']) as never
		),
		relationships: schema.traces.relationships
	},
	periods: schema.periods,
	scopes: {
		schema: S.Schema(without(schema.scopes.schema.properties, ['deletionOperationId']) as never)
	},
	scopeSegments: schema.scopeSegments,
	intersections: {
		schema: S.Schema(
			without(schema.intersections.schema.properties, [
				'fromEntityType',
				'activationId',
				'lifecycleId',
				'scopeDeletionOperationId'
			]) as never
		)
	},
	sources: schema.sources,
	assertions: schema.assertions,
	citations: schema.citations,
	assertionRelations: schema.assertionRelations,
	provenanceLinks: schema.provenanceLinks,
	logs: schema.logs
});

/** The C10 schema (9cd1fe3) added only Scope capture settings on top of the original. */
const c10Schema = S.Collections({
	...originalSchema,
	scopeCaptureSettings: schema.scopeCaptureSettings
});

const now = '2026-08-30T10:00:00.000Z';

/** Writes rows through a client of the historical schema and exports them the way that version did. */
const historicalFile = async (
	historical: typeof originalSchema | typeof c10Schema
): Promise<DataSpaceBackup> => {
	const client = new TriplitClient({
		schema: historical as never,
		storage: { type: 'memory' },
		autoConnect: false
	});
	clients.push(client as never);
	await client.insert('scopes', {
		id: 'scope-1',
		name: 'Здоровье',
		isDeleted: false,
		createdAt: now,
		updatedAt: now
	} as never);
	await client.insert('traces', {
		id: 'trace-1',
		capturedAt: now,
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: {
			basis: 'absolute',
			precision: 'day',
			certainty: 'exact',
			start: '2026-08-30',
			end: null
		},
		content: 'Опубликованная запись',
		relation: 'actual',
		isDeleted: false,
		createdAt: now,
		updatedAt: now
	} as never);
	await client.insert('intersections', {
		id: 'trace-1:scope-1:belongs_to',
		fromId: 'trace-1',
		toId: 'scope-1',
		kind: 'belongs_to',
		isDeleted: false,
		createdAt: now,
		updatedAt: now
	} as never);
	await client.insert('logs', {
		id: 'log-1',
		operationId: 'op-1',
		entityType: 'trace',
		entityId: 'trace-1',
		action: 'created',
		patchJson: '{}',
		occurredAt: now,
		deviceId: 'device-1',
		actor: 'user',
		cause: 'normal'
	} as never);
	if ('scopeCaptureSettings' in historical) {
		await client.insert('scopeCaptureSettings', {
			id: 'scope-1',
			suggestedKindIds: ['kind-legacy']
		} as never);
	}
	const collections = Object.fromEntries(
		await Promise.all(
			Object.keys(historical).map(async (name) => [
				name,
				await client.fetch(client.query(name as never) as never)
			])
		)
	) as DataSpaceBackup['collections'];
	return {
		format: BACKUP_FORMAT,
		exportedAt: now,
		dataSpace: { id: 'imported-old', label: 'Старый экспорт' },
		collections
	};
};

const restoreInto = async (file: DataSpaceBackup) => {
	const target = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(target as never);
	await createBackupRepository(target, createImportedDataSpace('Копия')).restore(file);
	return createTriplitRepository(target);
};

it('publishes exactly the historical profiles and keeps every original collection mandatory', () => {
	expect(BACKUP_COLLECTION_PROFILES.map((profile) => profile.length)).toEqual([15, 16, 17]);
	for (const profile of BACKUP_COLLECTION_PROFILES)
		expect(ORIGINAL_BACKUP_COLLECTIONS.every((name) => profile.includes(name))).toBe(true);
});

it('restores a first-release (d948e1d) export: introduced collections become empty, rows stay readable', async () => {
	const file = await historicalFile(originalSchema);
	expect(Object.keys(file.collections)).toHaveLength(15);
	const parsed = parseDataSpaceBackup(file);
	expect(parsed.collections.scopeCaptureSettings).toEqual([]);
	expect(parsed.collections.intentionAssessments).toEqual([]);
	const repository = await restoreInto(file);
	expect((await repository.listTraces()).map((trace) => trace.content)).toEqual([
		'Опубликованная запись'
	]);
	expect((await repository.listScopes()).map((scope) => scope.name)).toEqual(['Здоровье']);
	expect((await repository.listIntersections()).map((link) => link.id)).toEqual([
		'trace-1:scope-1:belongs_to'
	]);
	expect(await repository.listLogs()).toHaveLength(1);
	expect(await repository.listIntentionAssessments()).toEqual([]);
});

it('restores a C10 (9cd1fe3) export and keeps legacy capture settings as data, not memberships', async () => {
	const file = await historicalFile(c10Schema);
	expect(Object.keys(file.collections)).toHaveLength(16);
	const repository = await restoreInto(file);
	expect(await repository.listIntentionAssessments()).toEqual([]);
	// Legacy suggestions are restored verbatim and never turned into Kind memberships.
	expect((await repository.listIntersections()).every((link) => link.fromEntityType === null)).toBe(
		true
	);
	const [target] = clients.slice(-1);
	expect(await target.fetch(target.query('scopeCaptureSettings' as never) as never)).toEqual([
		{ id: 'scope-1', suggestedKindIds: ['kind-legacy'] }
	]);
});

it('refuses mixtures, unknown collections and missing original collections before writing', async () => {
	const file = await historicalFile(originalSchema);
	const variant =
		(mutate: (collections: Record<string, unknown>) => void): (() => DataSpaceBackup) =>
		() => {
			const copy = structuredClone(file) as DataSpaceBackup & {
				collections: Record<string, unknown>;
			};
			mutate(copy.collections);
			return copy;
		};
	// Original 15 plus assessments but without capture settings is no published version.
	expect(() => parseDataSpaceBackup(variant((c) => void (c.intentionAssessments = []))())).toThrow(
		'Набор коллекций'
	);
	expect(() => parseDataSpaceBackup(variant((c) => void (c.drafts = []))())).toThrow(
		'Набор коллекций'
	);
	for (const name of ORIGINAL_BACKUP_COLLECTIONS as readonly BackupCollection[]) {
		expect(() => parseDataSpaceBackup(variant((c) => void delete c[name])())).toThrow(
			'Набор коллекций'
		);
	}
	const target = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(target as never);
	const backup = createBackupRepository(target, createImportedDataSpace('Копия'));
	await expect(
		backup.restore(variant((c) => void (c.intentionAssessments = []))())
	).rejects.toThrow('Набор коллекций');
	await backup.restore(file);
	expect(await createTriplitRepository(target).listTraces()).toHaveLength(1);
});
