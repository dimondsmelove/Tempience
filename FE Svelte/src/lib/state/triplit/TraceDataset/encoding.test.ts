import { TriplitClient } from '@triplit/client';
import { afterEach, expect, it } from 'vitest';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import type {
	TraceDatasetDataFilter,
	TraceDatasetRequest,
	TraceDatasetRow,
	TraceDatasetSnapshot
} from '../trace-dataset';
import type { JsonObject, TraceDraft } from '../types';

const clients: TriplitClient<typeof schema>[] = [];
afterEach(async () => {
	for (const client of clients.splice(0)) {
		await client.clear({ full: true });
		client.disconnect();
	}
});

const dataSchema: JsonObject = {
	type: 'object',
	properties: {
		note: { type: 'string' },
		count: { type: 'number' },
		nested: { type: 'object', properties: { x: { type: 'number' } } },
		items: { type: 'array', items: { type: 'object', properties: { v: { type: 'number' } } } },
		'0': { type: 'object', properties: { note: { type: 'string' } } }
	}
};

const draft = (
	content: string,
	day: string,
	kind: { kindId: string; kindVId: string },
	data: JsonObject
): TraceDraft => ({
	content,
	capturedAt: `${day}T08:00:00.000Z`,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: { basis: 'absolute', precision: 'day', certainty: 'exact', start: day, end: null },
	relation: 'actual',
	...kind,
	data
});

/** Resolves the first ready/error snapshot of a request. */
const rows = (
	repository: TempienceRepository,
	request: TraceDatasetRequest
): Promise<TraceDatasetRow[]> =>
	new Promise((resolve, reject) => {
		let unsubscribe = (): void => {};
		const timer = setTimeout(() => {
			unsubscribe();
			reject(new Error('dataset timeout'));
		}, 5000);
		unsubscribe = repository.subscribeTraceDataset(request, (snapshot: TraceDatasetSnapshot) => {
			if (snapshot.status === 'loading') return;
			clearTimeout(timer);
			unsubscribe();
			if (snapshot.status === 'ready') resolve(snapshot.rows);
			else reject(new Error(JSON.stringify(snapshot)));
		});
	});

const setup = async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	clients.push(client);
	const repository = createTriplitRepository(client);
	const { kind, kindV } = await repository.createTraceKind({
		name: 'Mixed',
		initialKindV: { dataSchema }
	});
	const pinned = { kindId: kind.id, kindVId: kindV.id };
	// Legacy row with a user key "0" whose sub-value would match an unguarded encoded branch.
	const legacy = await repository.createTrace(
		draft('legacy', '2026-09-10', pinned, {
			note: 'y',
			count: 1,
			nested: { x: 1 },
			items: [{ v: 1 }],
			'0': { note: 'x' }
		})
	);
	// Rewritten row: encoded shape after an edit that removed keys.
	const encoded = await repository.createTrace(
		draft('encoded', '2026-09-11', pinned, {
			note: 'x',
			count: 2,
			nested: { x: 2, y: 9 },
			items: [{ v: 2 }, { v: 3 }]
		})
	);
	await repository.editTrace(encoded.id, {
		data: { note: 'x', count: 2, nested: { x: 2 }, items: [{ v: 2 }, { v: 3 }] }
	});
	// Encoded row whose date was cleared: aboutDate must read as empty.
	const undated = await repository.createTrace(
		draft('undated', '2026-09-12', pinned, { note: 'x', count: 3 })
	);
	await repository.editTrace(undated.id, { aboutTime: { basis: 'unknown' } });
	// Legacy row left behind by an earlier valid variant change (stale keys, no marker).
	await client.insert('traces', {
		id: 'stale',
		capturedAt: '2026-09-13T08:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: {
			basis: 'unknown',
			precision: 'day',
			certainty: 'exact',
			start: '2026-09-13',
			end: null
		},
		content: 'stale',
		relation: 'actual',
		kindId: kind.id,
		kindVId: kindV.id,
		data: { note: 'z', count: 4 },
		isDeleted: false,
		createdAt: '2026-09-13T08:00:00.000Z',
		updatedAt: '2026-09-13T08:00:00.000Z'
	} as never);
	const base: TraceDatasetRequest = {
		kindId: kind.id,
		columns: [
			{ key: 'date', source: 'core', field: 'aboutDate' },
			{ key: 'note', source: 'data', path: ['note'], expectedType: 'string' },
			{ key: 'count', source: 'data', path: ['count'], expectedType: 'number' },
			{ key: 'x', source: 'data', path: ['nested', 'x'], expectedType: 'number' }
		],
		order: { field: 'capturedAt', direction: 'ASC' }
	};
	return { client, repository, kind, pinned, legacy, encoded, undated, base };
};

const withFilter = (
	base: TraceDatasetRequest,
	...filters: TraceDatasetDataFilter[]
): TraceDatasetRequest => ({
	...base,
	filters
});

it('projects the same cells from legacy, encoded, stale and cleared rows', async () => {
	const { repository, base, legacy, encoded, undated } = await setup();
	const result = await rows(repository, base);
	expect(result.map((row) => [row.traceId, row.values])).toEqual([
		[legacy.id, { date: '2026-09-10', note: 'y', count: 1, x: 1 }],
		[encoded.id, { date: '2026-09-11', note: 'x', count: 2, x: 2 }],
		[undated.id, { date: null, note: 'x', count: 3, x: null }],
		['stale', { date: null, note: 'z', count: 4, x: null }]
	]);
});

it('filters both stored shapes exactly with every exposed operator', async () => {
	const { repository, base, legacy, encoded, undated } = await setup();
	const ids = async (...filters: TraceDatasetDataFilter[]) =>
		(await rows(repository, withFilter(base, ...filters))).map((row) => row.traceId);
	const note = (
		operator: TraceDatasetDataFilter['operator'],
		value: TraceDatasetDataFilter['value']
	) => ({ path: ['note'], expectedType: 'string', operator, value }) as const;
	// The legacy row's user key "0" holds note 'x' but its own note is 'y'.
	expect(await ids(note('=', 'x'))).toEqual([encoded.id, undated.id]);
	expect(await ids(note('!=', 'x'))).toEqual([legacy.id, 'stale']);
	expect(await ids(note('in', ['x', 'z']))).toEqual([encoded.id, undated.id, 'stale']);
	expect(await ids(note('nin', ['x']))).toEqual([legacy.id, 'stale']);
	expect(await ids(note('like', 'x%'))).toEqual([encoded.id, undated.id]);
	expect(await ids(note('nlike', 'x%'))).toEqual([legacy.id, 'stale']);
	expect(
		await ids({ path: ['nested', 'x'], expectedType: 'number', operator: 'isDefined', value: true })
	).toEqual([legacy.id, encoded.id]);
	expect(
		await ids({
			path: ['nested', 'x'],
			expectedType: 'number',
			operator: 'isDefined',
			value: false
		})
	).toEqual([undated.id, 'stale']);
	expect(await ids({ path: ['count'], expectedType: 'number', operator: '>=', value: 2 })).toEqual([
		encoded.id,
		undated.id,
		'stale'
	]);
	expect(await ids({ path: ['count'], expectedType: 'number', operator: '<', value: 2 })).toEqual([
		legacy.id
	]);
	expect(
		await ids(note('=', 'x'), { path: ['count'], expectedType: 'number', operator: '=', value: 2 })
	).toEqual([encoded.id]);
	// A key removed by the rewrite is absent for the encoded row and present for the legacy one.
	expect(
		await ids({ path: ['nested', 'y'], expectedType: 'number', operator: 'isDefined', value: true })
	).toEqual([]);
});

it('repeats nested items from both stored shapes without duplicates; no items is one row', async () => {
	const { repository, base, legacy, encoded, undated } = await setup();
	const result = await rows(repository, {
		...base,
		repeat: { path: ['items'] },
		columns: [
			{ key: 'note', source: 'data', path: ['note'], expectedType: 'string' },
			{ key: 'v', source: 'item', path: ['v'], expectedType: 'number' }
		]
	});
	// The rows without the group — `items` absent (undated, stale) — are rows of their own,
	// the item column blank; a record is never lost to a history for having no items.
	expect(result.map((row) => [row.traceId, row.itemIndex, row.values])).toEqual([
		[legacy.id, 0, { note: 'y', v: 1 }],
		[encoded.id, 0, { note: 'x', v: 2 }],
		[encoded.id, 1, { note: 'x', v: 3 }],
		[undated.id, undefined, { note: 'x', v: null }],
		['stale', undefined, { note: 'z', v: null }]
	]);
});

it('keeps a record whose repeated group was emptied as one row of its own', async () => {
	const { repository, base, pinned } = await setup();
	const emptied = await repository.createTrace(
		draft('emptied', '2026-09-14', pinned, { note: 'e', count: 5, items: [{ v: 7 }] })
	);
	await repository.editTrace(emptied.id, { data: { note: 'e', count: 5, items: [] } });
	const request: TraceDatasetRequest = {
		...base,
		repeat: { path: ['items'] },
		columns: [
			{ key: 'note', source: 'data', path: ['note'], expectedType: 'string' },
			{ key: 'v', source: 'item', path: ['v'], expectedType: 'number' }
		]
	};
	const result = await rows(repository, request);
	expect(result.filter((row) => row.traceId === emptied.id)).toEqual([
		{ traceId: emptied.id, kindVId: pinned.kindVId, values: { note: 'e', v: null } }
	]);
	// The same read by id, as a history page reads it.
	const page = await repository.readTraceDataset({ ...request, ids: [emptied.id] });
	expect(page.status === 'ready' && page.rows.map((row) => row.itemIndex)).toEqual([undefined]);
});

it('keeps the selected payload bounded to the requested paths in both shapes', async () => {
	const { client, base, kind } = await setup();
	const { buildTraceQuery } = await import('./query');
	const selected = await client.fetch(buildTraceQuery(client, base, null) as never, {
		policy: 'local-only'
	});
	for (const row of selected as Record<string, unknown>[]) {
		expect(Object.keys(row).sort()).toEqual(
			['aboutTime', 'data', 'encoding', 'id', 'kindVId'].filter((key) => key in row)
		);
		const data = row.data as Record<string, unknown> | undefined;
		if (data) {
			// Neither shape carries unrequested keys such as `items`.
			const inner = (data['0'] as Record<string, unknown> | undefined) ?? data;
			expect(Object.keys(inner)).not.toContain('items');
		}
	}
	expect(kind.id).toBeDefined();
});
