import { TriplitClient } from '@triplit/client';
import { describe, expect, it } from 'vitest';
import { createTriplitRepository } from './repository';
import { schema } from './schema';
import { traceEventKey, traceSpan } from './Traces/event-time';
import { buildRepositoryExplorerSnapshot } from '../Workbench/snapshot';
import { traceMarkTime, traceTimeLabel } from '$lib/model/Projection/marks';
import type { TraceDraft } from './types';

const NOW = Date.parse('2026-09-06T12:00:00.000Z');
const day = {
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start: '2026-08-10',
	end: null
} as const;
const draft: TraceDraft = {
	content: 'Начал читать книгу',
	capturedAt: '2026-08-10T12:00:00Z',
	timezone: 'Europe/Belgrade',
	aboutKind: 'interval',
	aboutTime: day
};

describe('open interval («длится», research п. 8)', () => {
	it('orders by its start and spans the calendar unit of its start until an end is known', () => {
		const placement = { aboutKind: 'interval' as const, aboutTime: day, statedDuration: null };
		expect(traceEventKey(placement)).toBe('2026-08-10T00:00:00.000Z');
		expect(traceSpan(placement)).toEqual({
			start: Date.parse('2026-08-10T00:00:00.000Z'),
			end: Date.parse('2026-08-11T00:00:00.000Z')
		});
	});

	it('round-trips through the repository: saved open, stretched to «сейчас», then closed («дочитал»)', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const repo = createTriplitRepository(client);
			const saved = await repo.createTrace(draft);
			expect(saved).toMatchObject({ aboutKind: 'interval', aboutTime: day, aboutEnd: null });
			const exact = await repo.createTrace({
				...draft,
				content: 'Начал в 9:00',
				aboutTime: { ...day, precision: 'minute', start: '2026-08-10T09:00:00+02:00' }
			});
			expect(exact).toMatchObject({ aboutStart: '2026-08-10T07:00:00.000Z', aboutEnd: null });

			const snapshot = await buildRepositoryExplorerSnapshot(repo, 'test');
			const projected = snapshot.traces.find((trace) => trace.id === saved.id)!;
			const mark = traceMarkTime(projected, NOW)!;
			expect(mark).toMatchObject({ kind: 'interval', open: true, intent: false });
			expect(mark.start).toBe(Date.parse('2026-08-10T00:00:00.000Z'));
			expect(mark.end).toBe(NOW);
			expect(mark.until).toBeUndefined();
			expect(traceTimeLabel(projected)).toBe('с 10 авг. 2026 г. — длится');
			expect(traceTimeLabel(projected, 'en')).toBe('since 10 Aug 2026 — ongoing');

			// «Дочитал»: the end arrives and the record is an ordinary closed interval.
			const closed = await repo.editTrace(saved.id, {
				aboutTime: { ...day, end: '2026-09-01' }
			});
			expect(closed.aboutTime).toEqual({ ...day, end: '2026-09-01' });
			const [after] = (await buildRepositoryExplorerSnapshot(repo, 'test')).traces.filter(
				(trace) => trace.id === saved.id
			);
			const closedMark = traceMarkTime(after, NOW)!;
			expect(closedMark.open).toBeUndefined();
			expect(closedMark.end).toBe(Date.parse('2026-09-02T00:00:00.000Z'));
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
});
