import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { versionSummaries } from '$lib/model/TraceForm/summary-fields';
import { intentionOf } from '$lib/state/TraceDraft/results.fixture';
import {
	numberKind,
	openDraftFixture,
	type DraftFixture
} from '$lib/state/TraceDraft/TraceDraft.fixture';
import type { JsonObject, TraceDraft } from '$lib/state/triplit/types';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const NOTE = 'Длинная заметка. '.repeat(64);

/** A version whose second leaf is a multi-line note: no row shows it, no thin read carries it. */
const noted = () => ({
	dataSchema: {
		type: 'object',
		properties: { weight: { type: 'number' }, note: { type: 'string' } }
	} as JsonObject,
	uiSchema: { note: { 'ui:components': { textWidget: 'textareaWidget' } } } as JsonObject
});

const typedRow = (kindId: string, kindVId: string, data: JsonObject): TraceDraft => ({
	content: '',
	capturedAt: '2026-09-13T08:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: { basis: 'unknown' },
	relation: 'actual',
	kindId,
	kindVId,
	data
});

describe('a thin read of records', () => {
	it('carries every row field and only the summary leaves of the data', async () => {
		const plan = await intentionOf(fx, 'План');
		const { kind, version } = await fx.kind('Замер', noted());
		const typed = await fx.repository.createTrace({
			content: '',
			capturedAt: '2026-09-13T08:00:00.000Z',
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime: {
				basis: 'absolute',
				precision: 'day',
				certainty: 'exact',
				start: '2026-09-12',
				end: null
			},
			relation: 'actual',
			kindId: kind.id,
			kindVId: version.id,
			data: { weight: 74.5, note: NOTE }
		});
		const summaries = versionSummaries([version]);
		expect(summaries).toEqual([{ kindVId: version.id, paths: [['weight']] }]);
		const rows = await fx.repository.listTraceHeads({ deleted: 'active', summaries });
		const head = rows.find((row) => row.id === typed.id)!;
		// The record is placed, named and typed as its whole read is; its data is the leaf alone.
		expect(head).toMatchObject({
			relation: 'actual',
			kindId: kind.id,
			kindVId: version.id,
			aboutTime: { basis: 'absolute', precision: 'day', start: '2026-09-12' },
			data: { weight: 74.5 }
		});
		expect(JSON.stringify(rows)).not.toContain('Длинная заметка');
		// A plain record reads with no data at all, and no crash on its null data.
		expect(rows.find((row) => row.id === plan.id)).toMatchObject({ content: 'План', data: null });
		// The whole read still holds the note: the Context reads records that way.
		expect((await fx.repository.getTrace(typed.id))?.data).toEqual({ weight: 74.5, note: NOTE });
	});

	it('reads rewritten data the same way as legacy data', async () => {
		const { kind, version } = await fx.kind('Вес', numberKind('Вес', 'weight'));
		const trace = await fx.repository.createTrace(typedRow(kind.id, version.id, { weight: 70 }));
		// An edit rewrites the data in its atomic shape; the thin read still names the leaf.
		await fx.repository.editTrace(trace.id, { data: { weight: 71 } });
		const [head] = await fx.repository.listTraceHeads({
			ids: [trace.id],
			deleted: 'all',
			summaries: [{ kindVId: version.id, paths: [['weight']] }]
		});
		expect(head.data).toEqual({ weight: 71 });
	});

	it('selects for each record the leaves of its own version: a nullable key another schema nests', async () => {
		// One schema nests `details`; the other keeps a nullable scalar under the same key.
		const nested = await fx.kind('Сессия', {
			dataSchema: {
				type: 'object',
				properties: { details: { type: 'object', properties: { count: { type: 'number' } } } }
			} as JsonObject
		});
		const flat = await fx.kind('Заметка', {
			dataSchema: {
				type: 'object',
				properties: { details: { type: ['string', 'null'] }, mood: { type: 'string' } }
			} as JsonObject
		});
		const deep = await fx.repository.createTrace(
			typedRow(nested.kind.id, nested.version.id, { details: { count: 3 } })
		);
		const legacy = await fx.repository.createTrace(
			typedRow(flat.kind.id, flat.version.id, { details: null, mood: 'ок' })
		);
		const encoded = await fx.repository.createTrace(
			typedRow(flat.kind.id, flat.version.id, { details: null, mood: 'так' })
		);
		await fx.repository.editTrace(encoded.id, { data: { details: null, mood: 'так себе' } });
		const summaries = versionSummaries([nested.version, flat.version]);
		expect(summaries.map((entry) => entry.paths.map((path) => path.join('.')))).toEqual([
			['details.count'],
			['details', 'mood']
		]);
		// The union of both schemas' paths crashed the read of the flat rows (a4aa202); each
		// record now gets its own version's leaves, the nullable one included, in both shapes.
		const rows = await fx.repository.listTraceHeads({ deleted: 'active', summaries });
		const dataOf = (id: string) => rows.find((row) => row.id === id)?.data;
		expect(dataOf(deep.id)).toEqual({ details: { count: 3 } });
		expect(dataOf(legacy.id)).toEqual({ details: null, mood: 'ок' });
		expect(dataOf(encoded.id)).toEqual({ details: null, mood: 'так себе' });
	});

	it('never reads a multi-line value another schema summarises under the same key', async () => {
		const short = await fx.kind('Короткая', {
			dataSchema: {
				type: 'object',
				properties: { note: { type: 'string' }, weight: { type: 'number' } }
			} as JsonObject
		});
		const long = await fx.kind('Длинная', noted());
		const brief = await fx.repository.createTrace(
			typedRow(short.kind.id, short.version.id, { note: 'кратко', weight: 1 })
		);
		const big = await fx.repository.createTrace(
			typedRow(long.kind.id, long.version.id, { weight: 2, note: NOTE })
		);
		const rows = await fx.repository.listTraceHeads({
			deleted: 'active',
			summaries: versionSummaries([short.version, long.version])
		});
		expect(rows.find((row) => row.id === brief.id)?.data).toEqual({ note: 'кратко', weight: 1 });
		const bigRow = rows.find((row) => row.id === big.id)!;
		expect(bigRow.data).toEqual({ weight: 2 });
		expect(JSON.stringify(bigRow).length).toBeLessThan(1500);
	});

	it('holds no data for a version outside the summaries or without a leaf', async () => {
		const { kind, version } = await fx.kind('Вес', numberKind('Вес', 'weight'));
		const trace = await fx.repository.createTrace(typedRow(kind.id, version.id, { weight: 70 }));
		const [unknown] = await fx.repository.listTraceHeads({
			ids: [trace.id],
			deleted: 'all',
			summaries: []
		});
		expect(unknown.data).toBeNull();
		const [leafless] = await fx.repository.listTraceHeads({
			ids: [trace.id],
			deleted: 'all',
			summaries: [{ kindVId: version.id, paths: [] }]
		});
		expect(leafless.data).toBeNull();
	});

	it('reads the deleted ones, the named ones, and nothing for no names', async () => {
		const plan = await intentionOf(fx, 'План');
		const other = await intentionOf(fx, 'Другой');
		await fx.repository.setTraceDeleted(other.id, true, 'user');
		const deleted = await fx.repository.listTraceHeads({ deleted: 'deleted', summaries: [] });
		expect(deleted.map((row) => row.id)).toEqual([other.id]);
		const named = await fx.repository.listTraceHeads({
			ids: [plan.id],
			deleted: 'all',
			summaries: []
		});
		expect(named.map((row) => row.id)).toEqual([plan.id]);
		expect(await fx.repository.listTraceHeads({ ids: [], deleted: 'all', summaries: [] })).toEqual(
			[]
		);
	});

	it('follows the records thin: a head with its own leaves, a changed value, a new record', async () => {
		const { kind, version } = await fx.kind('Вес', numberKind('Вес', 'weight'));
		const first = await fx.repository.createTrace(typedRow(kind.id, version.id, { weight: 70 }));
		const plan = await intentionOf(fx, 'План');
		const answers: { id: string; data: unknown }[][] = [];
		const stop = fx.repository.subscribeTraceHeads(
			{ deleted: 'active', summaries: versionSummaries([version]) },
			(rows) => answers.push(rows.map((row) => ({ id: row.id, data: row.data }))),
			() => {}
		);
		await expect.poll(() => answers.length, { timeout: 5000 }).toBeGreaterThan(0);
		// The first answer already holds the leaves of the typed record and the plain one's null.
		expect(answers[0]).toEqual(
			expect.arrayContaining([
				{ id: first.id, data: { weight: 70 } },
				{ id: plan.id, data: null }
			])
		);
		// A changed value reaches the list through the leaves' query, the heads unchanged.
		await fx.repository.editTrace(first.id, { data: { weight: 71 } });
		await expect
			.poll(() => answers.at(-1)?.find((row) => row.id === first.id)?.data, { timeout: 5000 })
			.toEqual({ weight: 71 });
		// A new record renews the leaves' query for the group, and arrives with its leaves.
		const second = await fx.repository.createTrace(typedRow(kind.id, version.id, { weight: 72 }));
		await expect
			.poll(() => answers.at(-1)?.find((row) => row.id === second.id)?.data, { timeout: 5000 })
			.toEqual({ weight: 72 });
		expect(answers.every((rows) => rows.every((row) => row.id !== first.id || row.data))).toBe(
			true
		);
		stop();
	});
});
