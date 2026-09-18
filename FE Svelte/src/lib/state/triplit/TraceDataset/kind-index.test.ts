import { TriplitClient } from '@triplit/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TempienceTriplitClient } from '../client';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import type { JsonObject, TraceAboutTime, TraceDraft } from '../types';
import type { KindIndexRequest, KindIndexSnapshot, TraceDatasetSnapshot } from '../trace-dataset';

const weightSchema: JsonObject = {
	type: 'object',
	additionalProperties: false,
	properties: { weight: { type: 'number' }, note: { type: 'string' } }
};
const textWeightSchema: JsonObject = {
	type: 'object',
	additionalProperties: false,
	properties: { weight: { type: 'string' } }
};

const minute = (start: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'minute',
	certainty: 'exact',
	start,
	end: null
});

const draft = (
	kindId: string,
	kindVId: string,
	capturedAt: string,
	aboutTime: TraceAboutTime | null,
	rest: Partial<TraceDraft> = {}
): TraceDraft => ({
	content: 'Замер',
	capturedAt,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime,
	kindId,
	kindVId,
	data: { weight: 70 },
	...rest
});

/** The snapshots of one live query, awaited by a condition. */
const probe = <Snapshot extends { status: string }>(
	subscribe: (callback: (snapshot: Snapshot) => void) => () => void
) => {
	const snapshots: Snapshot[] = [];
	let notify: (() => void) | null = null;
	const stop = subscribe((snapshot) => {
		snapshots.push(snapshot);
		notify?.();
	});
	return {
		stop,
		waitFor: async (
			predicate: (snapshot: Snapshot) => boolean,
			label = 'a snapshot'
		): Promise<Snapshot> => {
			const deadline = Date.now() + 3000;
			for (;;) {
				const last = snapshots.at(-1);
				if (last && predicate(last)) return last;
				if (Date.now() > deadline) {
					throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(last)}`);
				}
				await new Promise<void>((resolve) => {
					notify = resolve;
					setTimeout(resolve, 50);
				});
			}
		}
	};
};

let client: TempienceTriplitClient;
let repository: TempienceRepository;
beforeEach(() => {
	client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	repository = createTriplitRepository(client);
});
afterEach(async () => {
	await client.clear({ full: true });
	client.disconnect();
});

const ready = (snapshot: { status: string }) => snapshot.status === 'ready';
const rowsOf = (snapshot: KindIndexSnapshot) => (snapshot.status === 'ready' ? snapshot.rows : []);

describe('the thin index of one Kind', () => {
	it('places every active record by its E3 key and span, in both stored shapes', async () => {
		const { kind, kindV: v1 } = await repository.createTraceKind({
			name: 'Замер',
			initialKindV: { dataSchema: weightSchema }
		});
		const v2 = await repository.createTraceKindV(kind.id, { dataSchema: weightSchema });
		const at = draft(
			kind.id,
			v1.id,
			'2026-09-01T10:00:00.000Z',
			minute('2026-03-05T10:30:00.000Z')
		);
		const instant = await repository.createTrace(at);
		const day = await repository.createTrace(
			draft(kind.id, v2.id, '2026-09-02T10:00:00.000Z', {
				basis: 'absolute',
				precision: 'day',
				certainty: 'approximate',
				start: '2026-03-07',
				end: null
			})
		);
		const window = await repository.createTrace(
			draft(
				kind.id,
				v2.id,
				'2026-09-03T10:00:00.000Z',
				{
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: '2026-03-01T08:00:00.000Z',
					end: '2026-03-09T08:00:00.000Z'
				},
				{ aboutKind: 'interval' }
			)
		);
		const lasting = await repository.createTrace(
			draft(kind.id, v2.id, '2026-09-04T10:00:00.000Z', minute('2026-03-02T08:00:00.000Z'), {
				aboutKind: 'interval',
				statedDuration: { amount: 45, unit: 'minute' }
			})
		);
		const undated = await repository.createTrace(
			draft(kind.id, v1.id, '2026-09-05T10:00:00.000Z', { basis: 'unknown' })
		);
		const gone = await repository.createTrace(
			draft(kind.id, v1.id, '2026-09-06T10:00:00.000Z', minute('2026-03-06T10:00:00.000Z'))
		);
		await repository.setTraceDeleted(gone.id, true, 'user');
		// An edit stores the time in the rewritten shape; the index reads it the same.
		await repository.editTrace(instant.id, { content: 'Замер, уточнённый' });
		await repository.createTrace(
			draft(
				kind.id,
				null as never,
				'2026-09-07T10:00:00.000Z',
				minute('2026-03-06T10:00:00.000Z'),
				{
					kindId: null,
					kindVId: null,
					data: null
				}
			)
		);

		const index = probe<KindIndexSnapshot>((callback) =>
			repository.subscribeKindIndex({ kindId: kind.id }, callback)
		);
		try {
			const snapshot = await index.waitFor(
				(value) => value.status === 'ready' && value.rows.length === 5,
				'the five active records'
			);
			const byId = new Map(rowsOf(snapshot).map((row) => [row.id, row]));
			expect(byId.get(instant.id)).toMatchObject({
				kindVId: v1.id,
				key: '2026-03-05T10:30:00.000Z',
				span: { start: Date.parse('2026-03-05T10:30:00.000Z') }
			});
			// A day keeps the start of its calendar day; an interval with an end is keyed by its end.
			expect(byId.get(day.id)?.key).toBe('2026-03-07T00:00:00.000Z');
			expect(byId.get(window.id)?.key).toBe('2026-03-09T08:00:00.000Z');
			// A stated duration keeps the start.
			expect(byId.get(lasting.id)?.key).toBe('2026-03-02T08:00:00.000Z');
			expect(byId.get(undated.id)).toMatchObject({ key: null, span: null });
			expect(byId.has(gone.id)).toBe(false);
		} finally {
			index.stop();
		}
	});

	it('follows a changed date and a deletion, under a value filter and a Scope', async () => {
		const { kind, kindV } = await repository.createTraceKind({
			name: 'Замер',
			initialKindV: { dataSchema: weightSchema }
		});
		const scope = await repository.createScope({ name: 'Здоровье' });
		const heavy = await repository.createTrace(
			draft(kind.id, kindV.id, '2026-09-01T10:00:00.000Z', minute('2026-03-05T10:00:00.000Z'), {
				data: { weight: 80 }
			})
		);
		const light = await repository.createTrace(
			draft(kind.id, kindV.id, '2026-09-02T10:00:00.000Z', minute('2026-03-06T10:00:00.000Z'), {
				data: { weight: 60 }
			})
		);
		await repository.createIntersection({ fromId: heavy.id, toId: scope.id, kind: 'belongs_to' });
		await repository.createIntersection({ fromId: light.id, toId: scope.id, kind: 'belongs_to' });
		const request: KindIndexRequest = {
			kindId: kind.id,
			scope: { id: scope.id, mode: 'direct' },
			filters: [{ path: ['weight'], expectedType: 'number', operator: '>=', value: 70 }]
		};
		const index = probe<KindIndexSnapshot>((callback) =>
			repository.subscribeKindIndex(request, callback)
		);
		try {
			let snapshot = await index.waitFor(ready, 'the filtered index');
			expect(rowsOf(snapshot).map((row) => row.id)).toEqual([heavy.id]);
			await repository.editTrace(heavy.id, { aboutTime: minute('2026-04-01T09:00:00.000Z') });
			snapshot = await index.waitFor(
				(value) => rowsOf(value)[0]?.key === '2026-04-01T09:00:00.000Z',
				'the moved record'
			);
			expect(rowsOf(snapshot)).toHaveLength(1);
			await repository.setTraceDeleted(heavy.id, true, 'user');
			await index.waitFor((value) => ready(value) && rowsOf(value).length === 0, 'the deletion');
		} finally {
			index.stop();
		}
	});

	it('delivers again when a value of a record changes, so a page read on it shows the value', async () => {
		const { kind, kindV } = await repository.createTraceKind({
			name: 'Замер',
			initialKindV: { dataSchema: weightSchema }
		});
		const trace = await repository.createTrace(
			draft(kind.id, kindV.id, '2026-09-01T10:00:00.000Z', minute('2026-03-05T10:00:00.000Z'))
		);
		const deliveries: number[] = [];
		const stop = repository.subscribeKindIndex({ kindId: kind.id }, (snapshot) => {
			if (snapshot.status === 'ready') deliveries.push(snapshot.rows.length);
		});
		try {
			await expect.poll(() => deliveries.length, { timeout: 3000 }).toBe(1);
			// The index selects nothing of the data, but the changed record is in its view.
			await repository.editTrace(trace.id, { data: { weight: 71 } });
			await expect.poll(() => deliveries.length, { timeout: 3000 }).toBe(2);
			const page = await repository.readTraceDataset({
				kindId: kind.id,
				kindVId: kindV.id,
				ids: [trace.id],
				columns: [{ key: 'weight', source: 'data', path: ['weight'], expectedType: 'number' }]
			});
			expect(page).toMatchObject({
				status: 'ready',
				rows: [{ traceId: trace.id, values: { weight: 71 } }]
			});
		} finally {
			stop();
		}
	});

	it('refuses a value filter a version disagrees with, and an empty Kind', async () => {
		const { kind, kindV } = await repository.createTraceKind({
			name: 'Замер',
			initialKindV: { dataSchema: textWeightSchema }
		});
		await repository.createTraceKindV(kind.id, { dataSchema: weightSchema });
		const index = probe<KindIndexSnapshot>((callback) =>
			repository.subscribeKindIndex(
				{
					kindId: kind.id,
					filters: [{ path: ['weight'], expectedType: 'number', operator: '>', value: 1 }]
				},
				callback
			)
		);
		try {
			const snapshot = await index.waitFor((value) => value.status === 'incompatible');
			expect(snapshot).toMatchObject({
				status: 'incompatible',
				issues: [{ kindVId: kindV.id, path: ['weight'], reason: 'type_mismatch' }]
			});
		} finally {
			index.stop();
		}
		const bad = probe<KindIndexSnapshot>((callback) =>
			repository.subscribeKindIndex({ kindId: ' ' }, callback)
		);
		expect((await bad.waitFor((value) => value.status === 'error')).status).toBe('error');
		bad.stop();
	});
});

describe('a page of one version by ids', () => {
	it('answers the named records of that version with its own columns, and nothing for no ids', async () => {
		const { kind, kindV: v1 } = await repository.createTraceKind({
			name: 'Замер',
			initialKindV: { dataSchema: textWeightSchema }
		});
		const v2 = await repository.createTraceKindV(kind.id, { dataSchema: weightSchema });
		const old = await repository.createTrace(
			draft(kind.id, v1.id, '2026-09-01T10:00:00.000Z', minute('2026-03-05T10:00:00.000Z'), {
				data: { weight: '70' }
			})
		);
		const first = await repository.createTrace(
			draft(kind.id, v2.id, '2026-09-02T10:00:00.000Z', minute('2026-03-06T10:00:00.000Z'), {
				data: { weight: 71, note: 'утром' }
			})
		);
		const second = await repository.createTrace(
			draft(kind.id, v2.id, '2026-09-03T10:00:00.000Z', minute('2026-03-07T10:00:00.000Z'), {
				data: { weight: 72 }
			})
		);
		const columns = [
			{ key: 'about_at', source: 'core', field: 'aboutDate' },
			{ key: 'weight', source: 'data', path: ['weight'], expectedType: 'number' }
		] as const;
		// The first version gives the same key a text type: irrelevant to a page of the second.
		const page = probe<TraceDatasetSnapshot>((callback) =>
			repository.subscribeTraceDataset(
				{
					kindId: kind.id,
					kindVId: v2.id,
					ids: [second.id, first.id, old.id],
					columns: [...columns]
				},
				callback
			)
		);
		try {
			const snapshot = await page.waitFor(ready, 'the page');
			expect(snapshot.status).toBe('ready');
			if (snapshot.status !== 'ready') return;
			expect(snapshot.rows.map((row) => row.traceId).toSorted()).toEqual(
				[first.id, second.id].toSorted()
			);
			expect(snapshot.rows.find((row) => row.traceId === first.id)?.values).toEqual({
				about_at: '2026-03-06T10:00:00.000Z',
				weight: 71
			});
		} finally {
			page.stop();
		}
		const empty = probe<TraceDatasetSnapshot>((callback) =>
			repository.subscribeTraceDataset(
				{ kindId: kind.id, kindVId: v2.id, ids: [], columns: [...columns] },
				callback
			)
		);
		expect(await empty.waitFor(ready)).toMatchObject({ status: 'ready', rows: [] });
		empty.stop();
		// A version that is not the Kind's is an error, not an empty page.
		const wrong = probe<TraceDatasetSnapshot>((callback) =>
			repository.subscribeTraceDataset(
				{ kindId: kind.id, kindVId: 'nope', ids: [first.id], columns: [...columns] },
				callback
			)
		);
		expect((await wrong.waitFor((value) => value.status === 'error')).status).toBe('error');
		wrong.stop();
		// One read answers as the live query would: the same rows, the same refusals.
		const read = await repository.readTraceDataset({
			kindId: kind.id,
			kindVId: v2.id,
			ids: [second.id, first.id, old.id],
			columns: [...columns]
		});
		expect(read.status).toBe('ready');
		if (read.status === 'ready') {
			expect(read.rows.map((row) => row.traceId).toSorted()).toEqual(
				[first.id, second.id].toSorted()
			);
		}
		expect(
			(
				await repository.readTraceDataset({
					kindId: kind.id,
					kindVId: 'nope',
					ids: [first.id],
					columns: [...columns]
				})
			).status
		).toBe('error');
		expect(
			await repository.readTraceDataset({
				kindId: kind.id,
				kindVId: v2.id,
				ids: [],
				columns: [...columns]
			})
		).toMatchObject({ status: 'ready', rows: [] });
	});
});
