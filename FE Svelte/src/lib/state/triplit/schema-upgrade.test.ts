import { TriplitClient, Schema as S } from '@triplit/client';
import { BTreeKVStore } from '@triplit/db/storage/memory-btree';
import { expect, it } from 'vitest';
import { assessmentIdFor } from './IntentionAssessments/read';
import { createTriplitRepository } from './repository';
import { schema } from './schema';

it('opens a stored pre-34 schema and rows without rewriting their identities or adding logs', async () => {
	const legacySchema = S.Collections({
		...schema,
		scopes: {
			schema: S.Schema({
				id: S.Id(),
				name: S.String(),
				note: S.Optional(S.String()),
				parentScopeId: S.Optional(S.String()),
				startedAt: S.Optional(S.String()),
				endedAt: S.Optional(S.String()),
				isDeleted: S.Boolean(),
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
		}
	});
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({ schema: legacySchema, storage, autoConnect: false });
	const timestamp = '2026-09-12T12:00:00.000Z';
	await oldClient.insert('scopes', {
		id: 'legacy-scope',
		name: 'Старый Scope',
		isDeleted: false,
		createdAt: timestamp,
		updatedAt: timestamp
	});
	const before = await oldClient.fetch(oldClient.query('scopes'));
	oldClient.disconnect();
	const events: string[] = [];
	const client = new TriplitClient({
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
		await client.ready;
		expect(events).toEqual(['SUCCESS']);
		expect((await client.getSchema())?.collections.intersections.schema.properties).toHaveProperty(
			'activationId'
		);
		expect(await client.fetch(client.query('scopes'))).toEqual(before);
		const repo = createTriplitRepository(client);
		expect(await repo.listLogs()).toEqual([]);
		const { kind } = await repo.createTraceKind({
			name: 'Новый Kind',
			initialKindV: { dataSchema: { type: 'object', properties: {} } }
		});
		await repo.setTraceKindScopes(kind.id, ['legacy-scope']);
		await repo.setScopeDeleted('legacy-scope', true);
		await repo.setScopeDeleted('legacy-scope', false);
		expect(await repo.listIntersections()).toHaveLength(1);
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('opens a stored I2a schema without assessments, keeps rows and Log, then accepts assessments', async () => {
	const previous = Object.fromEntries(
		Object.entries(schema).filter(([name]) => name !== 'intentionAssessments')
	) as Omit<typeof schema, 'intentionAssessments'>;
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({
		schema: S.Collections(previous),
		storage,
		autoConnect: false
	});
	const oldRepo = createTriplitRepository(oldClient as never);
	const time = {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	} as const;
	const intention = await oldRepo.createTrace({
		content: 'Намерение',
		capturedAt: '2026-09-12T12:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: time,
		relation: 'intend'
	});
	const fact = await oldRepo.createTrace({
		content: 'Факт',
		capturedAt: '2026-09-12T12:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: time,
		relation: 'actual'
	});
	const link = await oldRepo.createIntersection({
		fromId: fact.id,
		toId: intention.id,
		kind: 'evidence_for'
	});
	const traces = await oldClient.fetch(oldClient.query('traces'));
	const intersections = await oldClient.fetch(oldClient.query('intersections'));
	const logs = await oldClient.fetch(oldClient.query('logs'));
	expect(logs).toHaveLength(3);
	oldClient.disconnect();

	const events: string[] = [];
	const client = new TriplitClient({
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
		await client.ready;
		expect(events).toEqual(['SUCCESS']);
		expect((await client.getSchema())?.collections.intentionAssessments).toBeDefined();
		expect(await client.fetch(client.query('traces'))).toEqual(traces);
		expect(await client.fetch(client.query('intersections'))).toEqual(intersections);
		expect(await client.fetch(client.query('logs'))).toEqual(logs);
		const repo = createTriplitRepository(client);
		expect(await repo.listIntentionAssessments()).toEqual([]);
		const assessment = await repo.createEvidenceAssessment(link.id, { outcome: 'completed' });
		expect(assessment.activationId).toBe(link.activationId);
		expect(await repo.listIntentionAssessments()).toEqual([assessment]);
		expect(await repo.listLogs()).toHaveLength(4);
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('opens a stored schema without the Trace encoding marker, keeps rows and Log, then encodes rewrites', async () => {
	const withoutMarker = S.Collections({
		...schema,
		traces: {
			schema: S.Schema(
				Object.fromEntries(
					Object.entries(schema.traces.schema.properties).filter(([key]) => key !== 'encoding')
				) as never
			),
			relationships: schema.traces.relationships
		}
	});
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({ schema: withoutMarker, storage, autoConnect: false });
	const oldRepo = createTriplitRepository(oldClient as never);
	const trace = await oldRepo.createTrace({
		content: 'Before the marker',
		capturedAt: '2026-09-12T12:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: {
			basis: 'absolute',
			precision: 'day',
			certainty: 'exact',
			start: '2026-09-11',
			end: null
		},
		relation: 'actual'
	});
	const traces = await oldClient.fetch(oldClient.query('traces'));
	const logs = await oldClient.fetch(oldClient.query('logs'));
	oldClient.disconnect();

	const events: string[] = [];
	const client = new TriplitClient({
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
		await client.ready;
		expect(events).toEqual(['SUCCESS']);
		expect((await client.getSchema())?.collections.traces.schema.properties).toHaveProperty(
			'encoding'
		);
		expect(await client.fetch(client.query('traces'))).toEqual(traces);
		expect(await client.fetch(client.query('logs'))).toEqual(logs);
		const repo = createTriplitRepository(client);
		expect((await repo.getTrace(trace.id))?.aboutTime).toEqual(trace.aboutTime);
		await repo.editTrace(trace.id, { aboutTime: { basis: 'unknown' } });
		const stored = await client.fetchById('traces', trace.id);
		expect(stored?.aboutTime).toEqual([{ basis: 'unknown' }]);
		expect(stored?.encoding).toEqual({ aboutTime: 1 });
		expect((await repo.getTrace(trace.id))?.aboutTime).toEqual({ basis: 'unknown' });
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('opens a stored schema without the transfer binding, keeps rows and Log, then accepts a retarget', async () => {
	const withoutBinding = S.Collections({
		...schema,
		intersections: {
			schema: S.Schema(
				Object.fromEntries(
					Object.entries(schema.intersections.schema.properties).filter(
						([key]) => key !== 'assessmentId'
					)
				) as never
			)
		}
	});
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({ schema: withoutBinding, storage, autoConnect: false });
	const oldRepo = createTriplitRepository(oldClient as never);
	const time = {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-11',
		end: null
	} as const;
	const trace = (content: string, relation: 'intend' | 'actual') => ({
		content,
		capturedAt: '2026-09-12T12:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant' as const,
		aboutTime: time,
		relation
	});
	const a = await oldRepo.createTrace(trace('A', 'intend'));
	const b = await oldRepo.createTrace(trace('B', 'intend'));
	const f = await oldRepo.createTrace(trace('F', 'actual'));
	const fa = await oldRepo.createIntersection({ fromId: f.id, toId: a.id, kind: 'evidence_for' });
	// The previous build stored the source row directly; its readiness check would refuse now.
	const sourceId = assessmentIdFor(fa.activationId ?? '');
	await oldClient.insert('intentionAssessments', {
		id: sourceId,
		source: 'evidence',
		origin: { factId: f.id, intentionId: a.id, evidenceId: fa.id, activationId: fa.activationId },
		initial: { 'op-old': { at: '2026-09-12T12:30:00.000Z', outcome: 'completed' } },
		updatedAt: '2026-09-12T12:30:00.000Z'
	} as never);
	const rows = {
		intersections: await oldClient.fetch(oldClient.query('intersections')),
		assessments: await oldClient.fetch(oldClient.query('intentionAssessments')),
		logs: await oldClient.fetch(oldClient.query('logs'))
	};
	oldClient.disconnect();

	const events: string[] = [];
	const client = new TriplitClient({
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
		await client.ready;
		expect(events).toEqual(['SUCCESS']);
		expect((await client.getSchema())?.collections.intersections.schema.properties).toHaveProperty(
			'assessmentId'
		);
		expect(await client.fetch(client.query('intersections'))).toEqual(rows.intersections);
		expect(await client.fetch(client.query('intentionAssessments'))).toEqual(rows.assessments);
		expect(await client.fetch(client.query('logs'))).toEqual(rows.logs);
		const repo = createTriplitRepository(client);
		const { link, assessment } = await repo.correctEvidenceTarget(fa.id, b.id);
		expect(link).toMatchObject({ toId: b.id, assessmentId: sourceId });
		expect(assessment).toMatchObject({
			id: sourceId,
			intentionId: b.id,
			firstAssessedAt: '2026-09-12T12:30:00.000Z',
			outcome: 'completed'
		});
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('opens a stored schema without any Scope colour, keeps rows and Log, then accepts a colour edit', async () => {
	const withoutColour = S.Collections({
		...schema,
		scopes: {
			schema: S.Schema(
				Object.fromEntries(
					Object.entries(schema.scopes.schema.properties).filter(
						([key]) => key !== 'colorHue' && key !== 'colorChroma' && key !== 'colorSlot'
					)
				) as never
			)
		}
	});
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({ schema: withoutColour, storage, autoConnect: false });
	const oldRepo = createTriplitRepository(oldClient as never);
	const stored = await oldRepo.createScope({ name: 'Белград', note: 'до цвета' });
	const rows = {
		scopes: await oldClient.fetch(oldClient.query('scopes')),
		logs: await oldClient.fetch(oldClient.query('logs'))
	};
	oldClient.disconnect();

	const events: string[] = [];
	const client = new TriplitClient({
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
		await client.ready;
		expect(events).toEqual(['SUCCESS']);
		expect((await client.getSchema())?.collections.scopes.schema.properties).toHaveProperty(
			'colorHue'
		);
		// Nothing is rewritten: the stored rows and Log are read as they were, the hue as null.
		expect(await client.fetch(client.query('scopes'))).toEqual(rows.scopes);
		expect(await client.fetch(client.query('logs'))).toEqual(rows.logs);
		const repo = createTriplitRepository(client);
		// A Scope stored before the third ring reads with no depth (0 to the ribbon), never rewritten.
		expect(await repo.listScopes()).toEqual([
			{ ...stored, colorHue: null, colorChroma: null, colorDepth: null }
		]);
		const coloured = await repo.editScope(stored.id, {
			colorHue: 267,
			colorChroma: 40,
			colorDepth: 2
		});
		expect(coloured).toMatchObject({
			id: stored.id,
			name: 'Белград',
			colorHue: 267,
			colorChroma: 40,
			colorDepth: 2
		});
		expect((await repo.listScopes())[0]).toMatchObject({
			colorHue: 267,
			colorChroma: 40,
			colorDepth: 2
		});
		expect(await repo.listLogs()).toHaveLength(rows.logs.length + 1);
		const cleared = await repo.editScope(stored.id, { colorHue: null, colorChroma: null });
		expect(cleared).toMatchObject({ colorHue: null, colorChroma: null });
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('reads a loop-005 row with a colour slot as the hue of the Графит wheel, then a hue save retires the slot', async () => {
	// The schema of loop 005: the slot, no hue.
	const withSlot = S.Collections({
		...schema,
		scopes: {
			schema: S.Schema(
				Object.fromEntries(
					Object.entries(schema.scopes.schema.properties).filter(
						([key]) => key !== 'colorHue' && key !== 'colorChroma'
					)
				) as never
			)
		}
	});
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({ schema: withSlot, storage, autoConnect: false });
	const timestamp = '2026-09-12T12:00:00.000Z';
	for (const [id, colorSlot] of [
		['slot-3', 3],
		['slot-1', 1],
		['slot-12', 12]
	] as const)
		await oldClient.insert('scopes', {
			id,
			name: id,
			colorSlot,
			isDeleted: false,
			createdAt: timestamp,
			updatedAt: timestamp
		});
	await oldClient.insert('scopes', {
		id: 'plain',
		name: 'plain',
		isDeleted: false,
		createdAt: timestamp,
		updatedAt: timestamp
	});
	const before = await oldClient.fetch(oldClient.query('scopes'));
	oldClient.disconnect();

	const client = new TriplitClient({ schema, storage, autoConnect: false });
	try {
		await client.ready;
		// Read-time only: the rows stay as the old build wrote them.
		expect(await client.fetch(client.query('scopes'))).toEqual(before);
		const repo = createTriplitRepository(client);
		const scopes = await repo.listScopes();
		const hues = Object.fromEntries(scopes.map((scope) => [scope.id, scope.colorHue]));
		// 212° + (n − 1)·27.5°, rounded to the degree: slot 3 → 267°, slot 12 → 514.5° ≡ 155°;
		// the saturation of a slot is the default.
		expect(hues).toEqual({ 'slot-1': 212, 'slot-3': 267, 'slot-12': 155, plain: null });
		expect(scopes.every((scope) => scope.colorChroma === null)).toBe(true);
		// A hue save writes the hue and clears the slot in the same update, so «без цвета» holds.
		const coloured = await repo.editScope('slot-3', { colorHue: 90 });
		expect(coloured.colorHue).toBe(90);
		expect(await client.fetchById('scopes', 'slot-3')).toMatchObject({
			colorHue: 90,
			colorSlot: null
		});
		const cleared = await repo.editScope('slot-1', { colorHue: null });
		expect(cleared.colorHue).toBeNull();
		expect((await repo.listScopes()).find((scope) => scope.id === 'slot-1')?.colorHue).toBeNull();
		expect(await client.fetchById('scopes', 'slot-1')).toMatchObject({ colorSlot: null });
		// A save of another field leaves the slot and its fallback alone.
		await repo.editScope('slot-12', { note: 'renamed' });
		expect((await repo.listScopes()).find((scope) => scope.id === 'slot-12')?.colorHue).toBe(155);
		expect(await client.fetchById('scopes', 'slot-12')).toMatchObject({ colorSlot: 12 });
		// The Log names the retired slot with the hue.
		const log = (await repo.listLogs()).find((entry) => entry.entityId === 'slot-3');
		expect(log?.patch).toMatchObject({
			colorHue: { before: null, after: 90 },
			colorSlot: { before: 3, after: null }
		});
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});
