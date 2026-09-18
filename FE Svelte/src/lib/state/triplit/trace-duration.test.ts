import { TriplitClient } from '@triplit/client';
import { describe, expect, it } from 'vitest';
import { createTriplitRepository } from './repository';
import { schema } from './schema';
import { parseStatedDuration, traceDuration } from './trace-duration';
import { assertTraceTemporalPlacement, traceAboutTimeBounds } from './trace-time';
import { buildRepositoryExplorerSnapshot } from '../Workbench/snapshot';
import { traceMarkTime, traceTimeLabel } from '$lib/model/Projection/marks';
import { createBackupRepository } from './Backup/Backup';
import { parseDataSpaceBackup } from './Backup/parse';
import { createImportedDataSpace, DATA_SPACES } from './data-space';
import type { TraceDraft } from './types';

const day = {
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start: '2026-09-09',
	end: null
} as const;
const amount = { amount: 150, unit: 'minute' } as const;
const draft: TraceDraft = {
	content: 'Читал',
	capturedAt: '2026-09-09T12:00:00Z',
	timezone: 'Europe/Belgrade',
	aboutKind: 'interval',
	aboutTime: day,
	statedDuration: amount
};

describe('Trace stated duration', () => {
	it('validates one positive amount without treating known boundaries as another input', () => {
		expect(parseStatedDuration(undefined)).toBeNull();
		for (const value of [
			0,
			{ amount: 0, unit: 'minute' },
			{ amount: 1.5, unit: 'day' },
			{ amount: 2, unit: 'hour' },
			{ ...amount, start: 'x' }
		])
			expect(() => parseStatedDuration(value)).toThrow();
		expect(() => assertTraceTemporalPlacement('interval', day, null, amount)).not.toThrow();
		expect(() => assertTraceTemporalPlacement('instant', day, null, amount)).toThrow();
		expect(() =>
			assertTraceTemporalPlacement('interval', { ...day, end: '2026-09-10' }, null, amount)
		).toThrow('boundaries');
		expect(
			traceDuration({
				...draft,
				statedDuration: null,
				aboutTime: { ...day, certainty: 'approximate', end: '2026-09-10' }
			})
		).toBeNull();
		expect(
			traceDuration({ ...draft, statedDuration: null, aboutTime: { ...day, end: '2026-09-10' } })
		).toEqual({ amount: 2, unit: 'day' });
	});
	it('round-trips through repository, journal and snapshot without constructing an interval on the axis', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const repo = createTriplitRepository(client);
			const saved = await repo.createTrace(draft);
			expect(saved).toMatchObject({
				statedDuration: amount,
				aboutAt: null,
				aboutStart: null,
				aboutEnd: null
			});
			const [projected] = (await buildRepositoryExplorerSnapshot(repo, 'test')).traces;
			expect(projected.statedDuration).toEqual(amount);
			const mark = traceMarkTime(projected)!;
			expect(mark.kind).toBe('moment');
			expect(mark.end).toBe(mark.start);
			expect(traceTimeLabel(projected)).toContain('2 ч 30 мин');
			await repo.editTrace(saved.id, { statedDuration: { amount: 165, unit: 'minute' } });
			expect(
				(await repo.listLogs(saved.id)).some(
					(log) =>
						log.patch.statedDuration?.after &&
						(log.patch.statedDuration.after as { amount: number }).amount === 165
				)
			).toBe(true);
			await expect(
				repo.editTrace(saved.id, {
					aboutTime: {
						...day,
						precision: 'minute',
						start: '2026-09-09T09:00:00+02:00',
						end: '2026-09-09T11:30:00+02:00'
					}
				})
			).rejects.toThrow('boundaries');
			const exact = await repo.editTrace(saved.id, {
				statedDuration: null,
				aboutTime: {
					...day,
					precision: 'minute',
					start: '2026-09-09T09:00:00+02:00',
					end: '2026-09-09T11:30:00+02:00'
				}
			});
			expect(traceDuration(exact)).toEqual(amount);
			expect(exact.aboutEnd).toBe('2026-09-09T09:30:00.000Z');
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
	it('preserves an unknown start and an uncertainty window of the start independently of the amount', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const repo = createTriplitRepository(client);
			const unknown = await repo.createTrace({
				...draft,
				aboutTime: { basis: 'unknown' },
				statedDuration: { amount: 4, unit: 'day' }
			});
			expect(
				traceAboutTimeBounds(unknown.aboutKind, unknown.aboutTime, unknown.statedDuration)
			).toBeNull();
			const window = {
				...day,
				certainty: 'approximate',
				start: '2026-09-01',
				end: '2026-09-10'
			} as const;
			const placed = await repo.editTrace(unknown.id, { aboutTime: window });
			expect(traceDuration(placed)).toEqual({ amount: 4, unit: 'day' });
			expect(
				traceAboutTimeBounds(placed.aboutKind, placed.aboutTime, placed.statedDuration)
			).toEqual({ start: Date.parse('2026-09-01'), end: Date.parse('2026-09-11') });
			const [projected] = (await buildRepositoryExplorerSnapshot(repo, 'test')).traces;
			expect(traceMarkTime(projected)?.kind).toBe('fuzzy');
			expect(traceTimeLabel(projected)).toContain('Начало: ≈');
			expect(placed.aboutStart).toBeNull();
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
	it('exports and imports quantities, old rows and journal, and rejects invalid new amounts before import', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const copy = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const repo = createTriplitRepository(client);
			const saved = await repo.createTrace(draft);
			const legacy = await repo.createTrace({
				...draft,
				aboutKind: 'instant',
				statedDuration: null
			});
			const file = JSON.parse(
				JSON.stringify(await createBackupRepository(client, DATA_SPACES.canonical).export())
			);
			delete file.collections.traces.find((row: { id: string }) => row.id === legacy.id)
				.statedDuration;
			await createBackupRepository(copy, createImportedDataSpace('Копия')).restore(file);
			const rows = await createTriplitRepository(copy).listTraces();
			expect(rows.find((row) => row.id === saved.id)?.statedDuration).toEqual(amount);
			expect(rows.find((row) => row.id === legacy.id)?.statedDuration).toBeNull();
			expect(await createTriplitRepository(copy).listLogs()).toEqual(await repo.listLogs());
			file.collections.traces.find(
				(row: { id: string }) => row.id === saved.id
			).statedDuration.amount = 0;
			expect(() => parseDataSpaceBackup(file)).toThrow('positive integer');
		} finally {
			await client.clear({ full: true });
			await copy.clear({ full: true });
			client.disconnect();
			copy.disconnect();
		}
	});
});
