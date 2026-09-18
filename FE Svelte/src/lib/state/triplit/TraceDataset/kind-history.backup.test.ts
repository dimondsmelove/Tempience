import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createBackupRepository } from '../Backup/Backup';
import { createTriplitRepository, type TempienceRepository } from '../repository';
import { schema } from '../schema';
import type { JsonObject, TraceAboutTime } from '../types';
import { seedHistoryFixture } from './history.fixture';

/**
 * Opt-in: TEMPIENCE_WRITE_BACKUP=1 writes a backup file the app restores through «Загрузить
 * JSON» — the one user path that seeds a browser database in bulk — to TEMPIENCE_BACKUP_OUT.
 * Without TEMPIENCE_BACKUP_ROWS it is the designed history of one Kind the rendered checks
 * read (e2e/fixtures/kind-history.backup.json); with it, the synthetic space of that many
 * rows for the rendered measurement.
 */
const enabled = process.env.TEMPIENCE_WRITE_BACKUP === '1';
const rows = process.env.TEMPIENCE_BACKUP_ROWS ? Number(process.env.TEMPIENCE_BACKUP_ROWS) : null;
const out =
	process.env.TEMPIENCE_BACKUP_OUT ??
	fileURLToPath(new URL('../../../../../e2e/fixtures/kind-history.backup.json', import.meta.url));

const minute = (start: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'minute',
	certainty: 'exact',
	start,
	end: null
});
const day = (start: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end: null
});

const NOTE_UI: JsonObject = { note: { 'ui:components': { textWidget: 'textareaWidget' } } };

/**
 * «Замер» in two versions. Version 1 (weight, a note) has 40 records over 2025 and 2 without
 * a date; version 2 (weight, pulse, a note) has 80 records over the first months of 2026 in
 * an order unlike their entry, 5 without a date, and 3 written backdated into 2024 — they
 * stay in version 2. Half of the records belong to «Здоровье», some to «Работа». «Сон» has a
 * number, a yes/no, a choice and a text field, and six records of February 2026: what the
 * value conditions of every type are checked on.
 */
const designed = async (repository: TempienceRepository) => {
	const health = await repository.createScope({ name: 'Здоровье' });
	const work = await repository.createScope({ name: 'Работа' });
	const { kind, kindV: v1 } = await repository.createTraceKind({
		name: 'Замер',
		initialKindV: {
			dataSchema: {
				type: 'object',
				properties: {
					weight: { type: 'number', title: 'Вес' },
					note: { type: 'string', title: 'Заметка' }
				}
			},
			uiSchema: NOTE_UI,
			fieldMeta: { '/properties/weight': { unit: { id: 'kg', label: 'кг' } } }
		}
	});
	const v2 = await repository.createTraceKindV(kind.id, {
		dataSchema: {
			type: 'object',
			properties: {
				weight: { type: 'number', title: 'Вес' },
				pulse: { type: 'number', title: 'Пульс' },
				note: { type: 'string', title: 'Заметка' }
			}
		},
		uiSchema: NOTE_UI,
		fieldMeta: { '/properties/weight': { unit: { id: 'kg', label: 'кг' } } },
		parentKindVIds: [v1.id]
	});
	await repository.setTraceKindScopes(kind.id, [health.id]);
	const { kind: sleep, kindV: sleepV } = await repository.createTraceKind({
		name: 'Сон',
		initialKindV: {
			dataSchema: {
				type: 'object',
				properties: {
					hours: { type: 'number', title: 'Часы' },
					deep: { type: 'boolean', title: 'Глубокий сон' },
					quality: {
						type: 'string',
						title: 'Качество',
						oneOf: [
							{ const: 'good', title: 'Хороший' },
							{ const: 'bad', title: 'Плохой' }
						]
					},
					note: { type: 'string', title: 'Заметка' }
				}
			}
		}
	});
	await repository.setTraceKindScopes(sleep.id, [health.id]);
	let captured = Date.UTC(2026, 3, 1);
	const write = async (
		kindVId: string,
		aboutTime: TraceAboutTime,
		data: JsonObject,
		scopeIds: string[],
		kindId = kind.id
	) => {
		captured += 60_000;
		const trace = await repository.createTrace({
			content: '',
			capturedAt: new Date(captured).toISOString(),
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime,
			relation: 'actual',
			kindId,
			kindVId,
			data
		});
		for (const scopeId of scopeIds) {
			await repository.createIntersection({ fromId: trace.id, toId: scopeId, kind: 'belongs_to' });
		}
	};
	for (let index = 0; index < 40; index += 1) {
		const date = new Date(Date.UTC(2025, 0, 3 + index * 9)).toISOString().slice(0, 10);
		await write(v1.id, day(date), { weight: 70 + (index % 7), note: `День ${index}` }, [
			index % 2 ? health.id : work.id
		]);
	}
	for (let index = 0; index < 2; index += 1) {
		await write(v1.id, { basis: 'unknown' }, { weight: 69, note: 'Без даты' }, [health.id]);
	}
	// The entry order of version 2 is not its event order: the table must sort by event.
	for (let index = 0; index < 80; index += 1) {
		const slot = (index * 37) % 80;
		const start = new Date(Date.UTC(2026, 0, 1 + slot, 8 + (slot % 5), 15)).toISOString();
		await write(
			v2.id,
			minute(start),
			{ weight: 75 + (slot % 21), pulse: 55 + (slot % 36), note: `Запись ${index}` },
			index % 2 ? [health.id] : index % 3 ? [work.id] : []
		);
	}
	for (let index = 0; index < 5; index += 1) {
		await write(v2.id, { basis: 'unknown' }, { weight: 80, pulse: 60, note: 'Без даты' }, [
			health.id
		]);
	}
	for (let index = 0; index < 3; index += 1) {
		await write(
			v2.id,
			day(`2024-06-0${index + 1}`),
			{ weight: 90, pulse: 70, note: 'Задним числом' },
			[health.id]
		);
	}
	for (let index = 0; index < 6; index += 1) {
		await write(
			sleepV.id,
			minute(`2026-02-0${index + 1}T07:00:00.000Z`),
			{
				hours: 6 + (index % 3),
				deep: index % 2 === 0,
				quality: index % 3 === 0 ? 'good' : 'bad',
				note: `Ночь ${index}`
			},
			[health.id],
			sleep.id
		);
	}
	await repository.createTrace({
		content: 'Обычная запись',
		capturedAt: new Date(captured + 60_000).toISOString(),
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: minute('2026-03-30T10:00:00.000Z'),
		relation: 'actual'
	});
};

it.skipIf(!enabled)(
	'writes a backup file of a Kind history',
	async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const repository = createTriplitRepository(client);
		try {
			if (rows === null) await designed(repository);
			else await seedHistoryFixture(client, repository, { rows });
			const backup = await createBackupRepository(
				client,
				{
					id: 'imported-00000000-0000-4000-8000-000000000034',
					kind: 'canonical',
					label: rows === null ? 'История вида записи' : `Синтетическое пространство ${rows}`,
					descriptionKey: 'dataSpace.description_imported',
					storageName: 'tempience-triplit-kind-history',
					syncEnabled: false
				},
				() => '2026-09-14T00:00:00.000Z'
			).export();
			mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
			writeFileSync(out, JSON.stringify(backup));
			expect(backup.collections.traces.length).toBeGreaterThan(0);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	},
	900_000
);
