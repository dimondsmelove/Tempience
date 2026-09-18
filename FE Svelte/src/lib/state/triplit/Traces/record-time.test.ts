import { afterEach, describe, expect, it } from 'vitest';
import { createId } from '../ids';
import { asRepositoryClient, type TempienceRepository } from '../repository';
import type { TraceAboutTime, TraceDuration } from '../types';
import { saveTraceRecordInTransaction, type TraceRecordSave } from './record';
import {
	openRecordFixture,
	outcome,
	plainDraft,
	plainFields,
	snapshotOf,
	type RecordFixture
} from './record.fixture';

let fixture: RecordFixture;
let repo: TempienceRepository;
afterEach(async () => {
	await fixture?.dispose();
});
const open = () => {
	fixture = openRecordFixture();
	repo = fixture.repository;
};

/** The save command's own clock: half a minute into 10:00 on 2026-09-13 (UTC). */
const AT = '2026-09-13T10:00:30.000Z';

/** The command path with its operation time injected instead of the wall clock. */
const saveAt = (save: TraceRecordSave, timestamp = AT) =>
	asRepositoryClient(fixture.client).transact((transaction) =>
		saveTraceRecordInTransaction(transaction, save, 'user', { id: createId(), timestamp })
	);

const minutes = (start: string, end: string | null = null): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'minute',
	certainty: 'exact',
	start,
	end
});
const intend = (aboutTime: TraceAboutTime, patch: Partial<TraceRecordSave['fields']> = {}) =>
	plainFields('Позвонить', { relation: 'intend', aboutTime, ...patch });

describe('saveTraceRecord — intention time at the operation clock', () => {
	it('refuses a new exact minute at or before the save time and leaves no fragment', async () => {
		open();
		const before = await snapshotOf(repo);
		for (const start of [
			'2026-09-13T10:00:00.000Z',
			'2026-09-13T10:00:30.000Z',
			'2026-09-13T12:00+02:00'
		]) {
			expect(await outcome(saveAt({ fields: intend(minutes(start)) }))).toBe('intention_time_past');
		}
		expect(await snapshotOf(repo)).toEqual(before);
		const next = await saveAt({ fields: intend(minutes('2026-09-13T10:01:00.000Z')) });
		expect(next.trace).toMatchObject({ relation: 'intend', createdAt: AT });
		expect(next.operation.timestamp).toBe(AT);
	});

	it('judges the planned start: an exact interval that has begun is not a new future plan', async () => {
		open();
		expect(
			await outcome(
				saveAt({
					fields: {
						...intend(minutes('2026-09-13T09:00Z', '2026-09-13T11:00Z')),
						aboutKind: 'interval'
					}
				})
			)
		).toBe('intention_time_past');
		const later = await saveAt({
			fields: {
				...intend(minutes('2026-09-13T10:30Z', '2026-09-13T11:00Z')),
				aboutKind: 'interval'
			}
		});
		expect(later.trace.aboutKind).toBe('interval');
		const duration: TraceDuration = { amount: 90, unit: 'minute' };
		expect(
			await outcome(
				saveAt({
					fields: {
						...intend(minutes('2026-09-13T10:00Z'), { statedDuration: duration }),
						aboutKind: 'interval'
					}
				})
			)
		).toBe('intention_time_past');
		expect(
			await outcome(
				saveAt({
					fields: {
						...intend(minutes('2026-09-13T10:01Z'), { statedDuration: duration }),
						aboutKind: 'interval'
					}
				})
			)
		).toBe('accepted');
		expect(await repo.listTraces()).toHaveLength(2);
	});

	it('lets a coarse unit or a declared window stand while it is not over', async () => {
		open();
		const day = (
			start: string,
			end: string | null = null,
			certainty: 'exact' | 'approximate' = 'exact'
		): TraceAboutTime => ({
			basis: 'absolute',
			precision: 'day',
			certainty,
			start,
			end
		});
		expect(await outcome(saveAt({ fields: intend(day('2026-09-13')) }))).toBe('accepted');
		expect(await outcome(saveAt({ fields: intend(day('2026-09-12')) }))).toBe(
			'intention_time_past'
		);
		expect(
			await outcome(saveAt({ fields: intend(day('2026-09-01', '2026-09-13', 'approximate')) }))
		).toBe('accepted');
		expect(
			await outcome(saveAt({ fields: intend(day('2026-09-01', '2026-09-12', 'approximate')) }))
		).toBe('intention_time_past');
		expect(
			await outcome(saveAt({ fields: intend(day('2026-09-13')) }, '2026-09-14T00:00:00.000Z'))
		).toBe('intention_time_past');
	});

	it('keeps a retained original time on edit and judges only a changed one', async () => {
		open();
		// Stored by a previous build through the generic path, which is not gated.
		const legacy = await repo.createTrace({
			...plainDraft('Старый план', 'intend'),
			aboutKind: 'interval',
			aboutTime: minutes('2026-09-13T09:00:00.000Z', '2026-09-13T11:00:00.000Z')
		});
		const renamed = await saveAt({ id: legacy.id, fields: { title: 'Старый план (правка)' } });
		expect(renamed.trace).toMatchObject({ content: 'Старый план (правка)', aboutKind: 'interval' });
		expect(
			await outcome(
				saveAt({
					id: legacy.id,
					fields: { aboutTime: minutes('2026-09-13T11:00+02:00', '2026-09-13T13:00+02:00') }
				})
			)
		).toBe('accepted');
		const before = await snapshotOf(repo);
		expect(
			await outcome(
				saveAt({
					id: legacy.id,
					fields: { aboutTime: minutes('2026-09-13T09:30Z', '2026-09-13T11:00Z') }
				})
			)
		).toBe('intention_time_past');
		expect(await snapshotOf(repo)).toEqual(before);
		expect(
			await outcome(
				saveAt({
					id: legacy.id,
					fields: { aboutTime: minutes('2026-09-13T10:30Z', '2026-09-13T11:00Z') }
				})
			)
		).toBe('accepted');
		expect(
			await outcome(saveAt({ id: legacy.id, fields: { aboutTime: { basis: 'unknown' } } }))
		).toBe('accepted');
	});
});
