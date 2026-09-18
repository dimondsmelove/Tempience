import { or } from '@triplit/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { numberKind } from '$lib/state/TraceDraft/TraceDraft.fixture';
import { openRecordFixture, type RecordFixture } from './record.fixture';

let fx: RecordFixture;
beforeEach(() => {
	fx = openRecordFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The contract of the installed SDK (@triplit/client 1.0.50) that `whereIds` answers to: a
 * read by `id in [...]` is a lookup and correct; a live query by `id in [...]` opened while
 * another one is open on the same collection answers with the other one's rows; a live
 * query naming its ids as a group of equalities answers its own. When an SDK change makes
 * the pinned defect disappear, this test says so, and the live form may become `in` again.
 */
describe('live queries by id in the installed SDK', () => {
	it('answers a concurrent `in` subscription with the rows of another, an `or` with its own', async () => {
		const client = fx.client;
		const { kind, kindV } = await fx.repository.createTraceKind({
			name: 'Вес',
			initialKindV: numberKind('Вес', 'weight')
		});
		const make = (weight: number) =>
			fx.repository.createTrace({
				content: '',
				capturedAt: '2026-09-13T08:00:00.000Z',
				timezone: 'UTC',
				aboutKind: 'instant',
				aboutTime: { basis: 'unknown' },
				relation: 'actual',
				kindId: kind.id,
				kindVId: kindV.id,
				data: { weight }
			});
		const a = await make(1);
		const b = await make(2);
		const idsOf = (rows: unknown[]) => rows.map((row) => String((row as { id: string }).id));
		const byIn = (ids: string[]) =>
			client
				.query('traces')
				.Where('id', 'in', ids)
				.Select(['id'] as never);
		const byOr = (ids: string[]) =>
			client
				.query('traces')
				.Where(or(ids.map((id) => ['id', '=', id] as const)) as never)
				.Select(['id'] as never);
		const answers: Record<string, string[][]> = { first: [], second: [], group: [] };
		const stops = [
			client.subscribe(
				byIn([a.id]),
				(rows) => answers.first.push(idsOf(rows)),
				() => {}
			)
		];
		await wait(200);
		stops.push(
			client.subscribe(
				byIn([b.id]),
				(rows) => answers.second.push(idsOf(rows)),
				() => {}
			),
			client.subscribe(
				byOr([b.id]),
				(rows) => answers.group.push(idsOf(rows)),
				() => {}
			)
		);
		await wait(300);
		try {
			expect(answers.first.at(-1)).toEqual([a.id]);
			// The read is right; the concurrent live `in` is not; the group of equalities is.
			expect(idsOf(await client.fetch(byIn([b.id])))).toEqual([b.id]);
			expect(answers.second.at(-1)).toEqual([a.id]);
			expect(answers.group.at(-1)).toEqual([b.id]);
		} finally {
			for (const stop of stops) stop();
		}
	});
});
