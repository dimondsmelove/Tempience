import { afterEach, expect, it } from 'vitest';
import { createId } from '../ids';
import { asRepositoryClient } from '../repository';
import { saveTraceRecordInTransaction } from './record';
import { minuteTime, openRecordFixture, plainFields, type RecordFixture } from './record.fixture';

let fixture: RecordFixture;
afterEach(async () => {
	await fixture?.dispose();
});

it('creates and persists an intention with an exact minute before the operation time', async () => {
	fixture = openRecordFixture();
	const timestamp = '2026-09-13T10:00:30.000Z';
	const aboutTime = minuteTime('2026-09-13T09:59:00.000Z');
	const saved = await asRepositoryClient(fixture.client).transact((transaction) =>
		saveTraceRecordInTransaction(
			transaction,
			{ fields: plainFields('Позвонить', { relation: 'intend', aboutTime }) },
			'user',
			{ id: createId(), timestamp }
		)
	);
	expect(saved.trace).toMatchObject({ relation: 'intend', aboutTime });
	expect((await fixture.repository.getTrace(saved.trace.id))?.aboutTime).toEqual(aboutTime);
});
