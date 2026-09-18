import { traceSchemaProjections } from '$lib/model/TraceForm/projections';
import { PAGE_SIZE } from '$lib/state/KindHistory/constants';
import { placeByVersion, pageOf } from '$lib/state/KindHistory/order';
import { performance } from 'node:perf_hooks';
import type { TempienceRepository } from '../../repository';
import type { KindIndexRequest, KindIndexSnapshot, TraceDatasetRequest } from '../../trace-dataset';
import type { HistoryFixture } from '../history.fixture';
import { bytes, memory } from './tools';

type Ready<S> = Extract<S, { status: 'ready' }>;

/** Subscribes and resolves with the first ready answer and the time to it; keeps following. */
const firstReady = <S extends { status: string }>(
	subscribe: (callback: (snapshot: S) => void) => () => void,
	onLater?: (snapshot: S) => void
): Promise<{ snapshot: Ready<S>; ms: number; stop: () => void }> =>
	new Promise((resolve, reject) => {
		const started = performance.now();
		let settled = false;
		const stop = subscribe((snapshot) => {
			if (settled) {
				onLater?.(snapshot);
				return;
			}
			if (snapshot.status === 'ready') {
				settled = true;
				resolve({
					snapshot: snapshot as Ready<S>,
					ms: Math.round(performance.now() - started),
					stop
				});
			} else if (snapshot.status === 'error' || snapshot.status === 'incompatible') {
				settled = true;
				reject(new Error(JSON.stringify(snapshot)));
			}
		});
	});

/**
 * One Kind's history as the surface reads it: the thin index of the Kind (cold), the pages
 * of its newest version by ids with that version's columns — a lookup each — the next page,
 * a Scope filter (a new index), a value filter, and an edit of one shown record's date — how
 * long the index takes to deliver the new order.
 */
export const measureHistory = async (repository: TempienceRepository, fixture: HistoryFixture) => {
	const kind = fixture.kinds.measure;
	const version = fixture.versions.v3;
	const projection = traceSchemaProjections(version.dataSchema)[0];
	const columns: TraceDatasetRequest['columns'] = projection.columns.map(({ column }) =>
		column.source === 'core' && column.field === 'aboutAt'
			? { ...column, field: 'aboutDate' }
			: column
	);
	const readIndex = async (request: KindIndexRequest, onLater?: (s: KindIndexSnapshot) => void) => {
		const { snapshot, ms, stop } = await firstReady<KindIndexSnapshot>(
			(callback) => repository.subscribeKindIndex(request, callback),
			onLater
		);
		return { rows: snapshot.rows, ms, bytes: bytes(snapshot.rows), stop };
	};
	// A page as the surface reads it: by lookup, on every answer of the index.
	const readPage = async (ids: readonly string[]) => {
		const started = performance.now();
		const snapshot = await repository.readTraceDataset({
			kindId: kind.id,
			kindVId: version.id,
			ids,
			columns
		});
		if (snapshot.status !== 'ready') throw new Error(JSON.stringify(snapshot));
		return {
			ms: Math.round(performance.now() - started),
			rows: snapshot.rows.length,
			bytes: bytes(snapshot.rows)
		};
	};

	const before = memory();
	let delivered: { at: number; rows: number } | null = null;
	const index = await readIndex({ kindId: kind.id }, (snapshot) => {
		if (snapshot.status === 'ready' && delivered === null) {
			delivered = { at: performance.now(), rows: snapshot.rows.length };
		}
	});
	const placedStart = performance.now();
	const placed = placeByVersion(index.rows, { from: '', to: '' });
	const placeMs = Math.round(performance.now() - placedStart);
	const rows = placed.get(version.id) ?? { dated: [], undated: [] };
	const firstPage = await readPage(pageOf(rows.dated, 0).map((row) => row.id));
	const nextPage = await readPage(pageOf(rows.dated, 1).map((row) => row.id));
	const lastPage = await readPage(
		pageOf(rows.dated, Math.ceil(rows.dated.length / PAGE_SIZE) - 1).map((row) => row.id)
	);

	// An edit of the first shown record moves it by a year: the index delivers the new order.
	const moved = rows.dated[0];
	const editStarted = performance.now();
	await repository.editTrace(moved.id, {
		aboutTime: {
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: '2019-06-01T10:00:00.000Z',
			end: null
		}
	});
	const editMs = Math.round(performance.now() - editStarted);
	const deadline = Date.now() + 10_000;
	while (delivered === null && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	const redelivery = delivered as { at: number; rows: number } | null;
	index.stop();

	const scoped = await readIndex({
		kindId: kind.id,
		scope: { id: fixture.scopes[0].id, mode: 'direct' }
	});
	scoped.stop();
	const filtered = await readIndex({
		kindId: kind.id,
		filters: [{ path: ['weight'], expectedType: 'number', operator: '>=', value: 80 }]
	});
	filtered.stop();
	const after = memory();

	return {
		kind: kind.name,
		version: version.id,
		index: {
			ms: index.ms,
			rows: index.rows.length,
			bytes: index.bytes,
			placeMs,
			dated: rows.dated.length,
			undated: rows.undated.length,
			versions: [...placed.entries()].map(([id, entry]) => ({
				id,
				dated: entry.dated.length,
				undated: entry.undated.length
			}))
		},
		firstPage,
		nextPage,
		lastPage,
		edit: {
			ms: editMs,
			indexRedeliveredMs: redelivery ? Math.round(redelivery.at - editStarted) : null,
			rowsAfter: redelivery?.rows ?? null
		},
		scopedIndex: { ms: scoped.ms, rows: scoped.rows.length, bytes: scoped.bytes },
		filteredIndex: { ms: filtered.ms, rows: filtered.rows.length, bytes: filtered.bytes },
		memoryMiB: { before, after }
	};
};
