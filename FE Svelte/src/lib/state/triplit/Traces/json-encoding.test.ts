import { TriplitClient, Schema as S } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { RepositoryError } from '../Repository/errors';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import type { JsonObject, TraceDraft } from '../types';
import { parseTraceEncoding, readSelectedTraceField, readStoredTraceField } from './json-encoding';

const clients: TriplitClient<typeof schema>[] = [];
const createClient = (): TriplitClient<typeof schema> => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	return client;
};
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const dayTime = (start: string) =>
	({ basis: 'absolute', precision: 'day', certainty: 'exact', start, end: null }) as const;

const draft = (content: string, data?: JsonObject, kind?: { kindId: string; kindVId: string }) =>
	({
		content,
		capturedAt: '2026-09-13T08:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: dayTime('2026-09-11'),
		relation: 'actual',
		...(kind ?? {}),
		...(data ? { data } : {})
	}) satisfies TraceDraft;

const dataSchema: JsonObject = {
	type: 'object',
	properties: {
		count: { type: 'number' },
		note: { type: 'string' },
		mood: { type: ['string', 'null'] },
		nested: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
		items: { type: 'array', items: { type: 'object', properties: { v: { type: 'number' } } } },
		'0': { type: 'object', properties: { note: { type: 'string' } } }
	},
	required: ['count', 'mood']
};

const raw = (client: TriplitClient<typeof schema>, id: string) =>
	client.fetchById('traces', id, { policy: 'local-only' });

it('rewrites aboutTime atomically and keeps every reader exact across basis changes', async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const anchor = await repository.createTrace(draft('anchor'));
	const trace = await repository.createTrace(draft('time'));
	expect((await raw(client, trace.id))?.encoding).toBeUndefined();

	const unknown = await repository.editTrace(trace.id, { aboutTime: { basis: 'unknown' } });
	expect(unknown.aboutTime).toEqual({ basis: 'unknown' });
	expect(await repository.getTrace(trace.id)).toEqual(unknown);
	expect((await repository.listTraces()).map((row) => row.id).sort()).toEqual(
		[anchor.id, trace.id].sort()
	);
	const stored = await raw(client, trace.id);
	expect(stored?.aboutTime).toEqual([{ basis: 'unknown' }]);
	expect(stored?.encoding).toEqual({ aboutTime: 1 });
	expect(stored?.data).toBeNull();
	const [log] = await repository.listLogs(trace.id);
	expect(log.patch.aboutTime).toEqual({
		before: dayTime('2026-09-11'),
		after: { basis: 'unknown' }
	});

	const relative = await repository.editTrace(trace.id, {
		aboutTime: { basis: 'relative', precision: 'day', anchorTraceId: anchor.id, relation: 'after' }
	});
	expect((await repository.getTrace(trace.id))?.aboutTime).toEqual(relative.aboutTime);
	expect((await raw(client, trace.id))?.aboutTime).toEqual([relative.aboutTime]);

	const absolute = await repository.editTrace(trace.id, { aboutTime: dayTime('2026-09-12') });
	expect((await repository.getTrace(trace.id))?.aboutTime).toEqual(dayTime('2026-09-12'));
	expect(absolute.aboutTime).toEqual(dayTime('2026-09-12'));

	// A content-only edit neither rewrites the field nor touches the marker.
	await repository.editTrace(trace.id, { content: 'renamed' });
	expect((await raw(client, trace.id))?.encoding).toEqual({ aboutTime: 1 });
	expect((await raw(client, trace.id))?.aboutTime).toEqual([dayTime('2026-09-12')]);
});

it('rewrites typed data atomically: removals, nulls, empty objects, arrays and a user key "0"', async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const { kind, kindV } = await repository.createTraceKind({
		name: 'Codec',
		initialKindV: { dataSchema }
	});
	const pinned = { kindId: kind.id, kindVId: kindV.id };
	const initial = {
		count: 1,
		note: 'keep me',
		mood: 'fine',
		nested: { x: 1, y: 2 },
		items: [{ v: 1 }, { v: 2 }],
		'0': { note: 'user zero' }
	};
	const trace = await repository.createTrace(draft('typed', initial, pinned));
	expect((await raw(client, trace.id))?.data).toEqual(initial);

	const edited = { count: 2, mood: null, nested: { x: 1 }, items: [{ v: 3 }], empty: {} };
	const first = await repository.editTrace(trace.id, { data: edited });
	expect(first.data).toEqual(edited);
	expect((await repository.getTrace(trace.id))?.data).toEqual(edited);
	const stored = await raw(client, trace.id);
	expect(stored?.data).toEqual([edited]);
	expect(stored?.encoding).toEqual({ data: 1 });
	expect(stored?.aboutTime).toEqual(dayTime('2026-09-11'));
	expect((await repository.listLogs(trace.id))[0].patch.data).toEqual({
		before: initial,
		after: edited
	});

	// Clearing to an empty object and to null both stay exact and encoded.
	await repository.editTrace(trace.id, { data: { count: 0, mood: null } });
	expect((await repository.getTrace(trace.id))?.data).toEqual({ count: 0, mood: null });
	expect((await raw(client, trace.id))?.data).toEqual([{ count: 0, mood: null }]);

	// Rewriting the date afterwards adds its own marker and leaves the data marker alone.
	await repository.editTrace(trace.id, { aboutTime: { basis: 'unknown' } });
	expect((await raw(client, trace.id))?.encoding).toEqual({ data: 1, aboutTime: 1 });
	expect((await repository.getTrace(trace.id))?.data).toEqual({ count: 0, mood: null });

	// Repeating the same data is a no-op edit: nothing written, no journal entry.
	const logs = (await repository.listLogs(trace.id)).length;
	await repository.editTrace(trace.id, { data: { count: 0, mood: null } });
	expect(await repository.listLogs(trace.id)).toHaveLength(logs);
});

it('reads legacy stale-basis rows through the projection and rejects unknown keys', async () => {
	const client = createClient();
	const repository = createTriplitRepository(client);
	const legacyRow = {
		id: 'legacy-stale',
		capturedAt: '2026-09-13T08:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		// What earlier builds left behind after switching absolute -> unknown.
		aboutTime: {
			basis: 'unknown',
			precision: 'day',
			certainty: 'exact',
			start: '2026-09-11',
			end: null
		},
		content: 'stale',
		relation: 'actual',
		data: { '0': { note: 'legacy zero' }, note: 'top' },
		isDeleted: false,
		createdAt: '2026-09-13T08:00:00.000Z',
		updatedAt: '2026-09-13T08:00:00.000Z'
	};
	await client.insert('traces', legacyRow as never);
	const trace = await repository.getTrace('legacy-stale');
	expect(trace?.aboutTime).toEqual({ basis: 'unknown' });
	expect(trace?.aboutAt).toBeNull();
	expect(trace?.data).toEqual({ '0': { note: 'legacy zero' }, note: 'top' });
	expect((await raw(client, 'legacy-stale'))?.aboutTime).toEqual(legacyRow.aboutTime);

	// The next rewrite converts the field and leaves nothing stale behind.
	await repository.editTrace('legacy-stale', { aboutTime: dayTime('2026-09-12') });
	expect((await raw(client, 'legacy-stale'))?.aboutTime).toEqual([dayTime('2026-09-12')]);

	await client.insert('traces', {
		...legacyRow,
		id: 'legacy-unknown-key',
		aboutTime: { basis: 'unknown', extra: true }
	} as never);
	await expect(repository.getTrace('legacy-unknown-key')).rejects.toThrow('unsupported fields');
});

it('reports corrupt encoded shapes instead of guessing', () => {
	const row = {
		id: 't',
		aboutTime: [{ basis: 'unknown' }],
		data: null,
		encoding: { aboutTime: 1 }
	};
	expect(readStoredTraceField(row, 'aboutTime')).toEqual({
		encoded: true,
		value: { basis: 'unknown' }
	});
	expect(readStoredTraceField(row, 'data')).toEqual({ encoded: false, value: null });
	expect(() =>
		readStoredTraceField({ ...row, aboutTime: { basis: 'unknown' } }, 'aboutTime')
	).toThrow('singleton array');
	expect(() => readStoredTraceField({ ...row, aboutTime: [] }, 'aboutTime')).toThrow(
		'singleton array'
	);
	expect(() => readStoredTraceField({ ...row, encoding: { aboutTime: 2 } }, 'aboutTime')).toThrow(
		'unsupported version'
	);
	expect(() => parseTraceEncoding({ content: 1 })).toThrow('unsupported field');
	expect(() => parseTraceEncoding('x')).toThrow('must be an object');
	expect(parseTraceEncoding(undefined)).toEqual({});
	// Selected reads see the "0"-keyed projection of an encoded field but the plain legacy object.
	expect(
		readSelectedTraceField({ id: 's', data: { '0': { a: 1 } }, encoding: { data: 1 } }, 'data')
	).toEqual({ a: 1 });
	expect(readSelectedTraceField({ id: 's', data: { '0': { a: 1 } } }, 'data')).toEqual({
		'0': { a: 1 }
	});
	expect(readSelectedTraceField({ id: 's', encoding: { data: 1 } }, 'data')).toBeUndefined();
	expect(() =>
		readSelectedTraceField({ id: 's', data: 'x', encoding: { data: 1 } }, 'data')
	).toThrow('unsupported encoded shape');
});

it('refuses to rewrite on a storage that still runs the schema without the marker', async () => {
	const previous = S.Collections({
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
	const client = new TriplitClient({
		schema: previous,
		storage: { type: 'memory' },
		autoConnect: false
	});
	clients.push(client as never);
	const repository = createTriplitRepository(client as never);
	const trace = await repository.createTrace(draft('old schema'));
	let failure: unknown;
	try {
		await repository.editTrace(trace.id, { aboutTime: { basis: 'unknown' } });
	} catch (error) {
		failure = error;
	}
	expect(failure).toBeInstanceOf(RepositoryError);
	expect((failure as RepositoryError).code).toBe('storage_schema');
	expect((failure as RepositoryError).message).toMatch('traces.encoding');
	expect((await repository.getTrace(trace.id))?.aboutTime).toEqual(dayTime('2026-09-11'));
});
