import type { TempienceTriplitClient } from '../client';
import type { TempienceRepository } from '../repository';
import { exactTraceTimeProjection } from '../trace-time';
import { TRACE_FIELD_ENCODING } from '../Traces/json-encoding';
import type { JsonObject, Scope, TraceAboutTime, TraceKind, TraceKindV } from '../types';

/**
 * A reproducible synthetic space for measuring the readers at scale: several Kinds with their
 * own versions — a renamed stable key, a field removed by a later version, a different unit,
 * a multi-line note no row shows — plain records among them, Scope memberships of zero, one
 * or two Scopes, and every temporal placement the model supports: exact minutes, days,
 * months, years, approximate instants, stated durations, undated records and records
 * backdated into an earlier version's era. Rows are inserted in the two stored shapes the
 * repository writes: legacy objects and rewritten singleton arrays with their marker.
 * Everything derives from the seed, so two runs build the same space.
 */
export type HistoryFixtureOptions = Readonly<{
	rows: number;
	seed?: number;
	batch?: number;
	/** Bytes of the multi-line note every measured Kind row carries and no row summary shows. */
	noteBytes?: number;
}>;

export type HistoryFixture = Readonly<{
	kinds: Readonly<{ measure: TraceKind; sleep: TraceKind; diary: TraceKind }>;
	versions: Readonly<{
		v1: TraceKindV;
		v2: TraceKindV;
		v3: TraceKindV;
		sleep: TraceKindV;
		diary: TraceKindV;
	}>;
	scopes: readonly Scope[];
	/** Ids of rows of each temporal case, for targeted reads. */
	samples: Readonly<Record<TemporalCase, string[]>>;
	counts: Readonly<{ traces: number; memberships: number; byVersion: Record<string, number> }>;
	seedMs: number;
}>;

export type TemporalCase =
	| 'minute'
	| 'day'
	| 'month'
	| 'year'
	| 'approximate'
	| 'duration'
	| 'interval'
	| 'undated'
	| 'backdated'
	| 'plain';

/** A small deterministic generator (mulberry32). */
const random = (seed: number) => {
	let state = seed >>> 0;
	return (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

const note = (bytes: number): string =>
	'Заметка о замере. '.repeat(Math.ceil(bytes / 34)).slice(0, bytes);

const MEASURE_V1: JsonObject = {
	type: 'object',
	properties: {
		weight: { type: 'number', title: 'Вес' },
		note: { type: 'string', title: 'Заметка' }
	}
};
const MEASURE_V2: JsonObject = {
	type: 'object',
	properties: {
		weight: { type: 'number', title: 'Вес' },
		pulse: { type: 'number', title: 'Пульс' },
		note: { type: 'string', title: 'Заметка' }
	}
};
/** The stable key `weight` renamed to «Масса»; `pulse` gone; a new field in another unit. */
const MEASURE_V3: JsonObject = {
	type: 'object',
	properties: {
		weight: { type: 'number', title: 'Масса' },
		weight_lb: { type: 'number', title: 'Масса, фунты' },
		note: { type: 'string', title: 'Заметка' }
	}
};
const NOTE_UI: JsonObject = { note: { 'ui:components': { textWidget: 'textareaWidget' } } };
const SLEEP: JsonObject = {
	type: 'object',
	properties: {
		hours: { type: 'number', title: 'Часы' },
		quality: {
			type: 'string',
			title: 'Качество',
			oneOf: [
				{ const: 'good', title: 'Хорошо' },
				{ const: 'poor', title: 'Плохо' }
			]
		}
	}
};
const DIARY: JsonObject = {
	type: 'object',
	properties: { text: { type: 'string', title: 'Текст' } }
};
const DIARY_UI: JsonObject = { text: { 'ui:components': { textWidget: 'textareaWidget' } } };

const ERA_START = Date.UTC(2016, 0, 1);
const ERA_END = Date.UTC(2026, 8, 1);

const pad = (value: number, length: number): string => String(value).padStart(length, '0');
const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const month = (ms: number): string => new Date(ms).toISOString().slice(0, 7);
const year = (ms: number): string => new Date(ms).toISOString().slice(0, 4);

export const seedHistoryFixture = async (
	client: TempienceTriplitClient,
	repository: TempienceRepository,
	options: HistoryFixtureOptions
): Promise<HistoryFixture> => {
	const rng = random(options.seed ?? 34);
	const batch = options.batch ?? 1000;
	const noteText = note(options.noteBytes ?? 1216);
	const started = performance.now();
	const { kind: measure, kindV: v1 } = await repository.createTraceKind({
		name: 'Замер',
		initialKindV: {
			dataSchema: MEASURE_V1,
			uiSchema: NOTE_UI,
			fieldMeta: { '/properties/weight': { unit: { id: 'kg', label: 'кг' } } }
		}
	});
	const v2 = await repository.createTraceKindV(measure.id, {
		dataSchema: MEASURE_V2,
		uiSchema: NOTE_UI,
		fieldMeta: { '/properties/weight': { unit: { id: 'kg', label: 'кг' } } },
		parentKindVIds: [v1.id]
	});
	const v3 = await repository.createTraceKindV(measure.id, {
		dataSchema: MEASURE_V3,
		uiSchema: NOTE_UI,
		fieldMeta: {
			'/properties/weight': { unit: { id: 'kg', label: 'кг' } },
			'/properties/weight_lb': { unit: { id: 'lb', label: 'фунт' } }
		},
		parentKindVIds: [v2.id]
	});
	const { kind: sleep, kindV: sleepV } = await repository.createTraceKind({
		name: 'Сон',
		initialKindV: {
			dataSchema: SLEEP,
			fieldMeta: { '/properties/hours': { unit: { id: 'h', label: 'ч' } } }
		}
	});
	const { kind: diary, kindV: diaryV } = await repository.createTraceKind({
		name: 'Дневник',
		initialKindV: { dataSchema: DIARY, uiSchema: DIARY_UI }
	});
	const scopes: Scope[] = [];
	for (const name of ['Здоровье', 'Работа', 'Дом', 'Спорт', 'Путешествия']) {
		scopes.push(await repository.createScope({ name }));
	}
	// The Kinds' direct Scopes: where the Scope panel offers each Kind's history.
	await repository.setTraceKindScopes(measure.id, [scopes[0].id, scopes[3].id]);
	await repository.setTraceKindScopes(sleep.id, [scopes[0].id]);
	await repository.setTraceKindScopes(diary.id, [scopes[2].id]);
	const samples: Record<TemporalCase, string[]> = {
		minute: [],
		day: [],
		month: [],
		year: [],
		approximate: [],
		duration: [],
		interval: [],
		undated: [],
		backdated: [],
		plain: []
	};
	const byVersion: Record<string, number> = {};
	let memberships = 0;
	const rows = options.rows;
	for (let from = 0; from < rows; from += batch) {
		await client.transact(async (transaction) => {
			for (let index = from; index < Math.min(rows, from + batch); index += 1) {
				const id = `i6-${pad(index, 7)}`;
				const share = index / rows;
				// Creation time runs through the eras in order; the event time usually near it.
				const createdMs = ERA_START + Math.floor(share * (ERA_END - ERA_START));
				const kindShare = rng();
				let kindId: string | null;
				let kindVId: string | null;
				let data: JsonObject | null;
				let content = '';
				if (kindShare < 0.6) {
					kindId = measure.id;
					const era = share < 0.2 ? v1 : share < 0.4 ? v2 : v3;
					kindVId = era.id;
					const weight = Math.round((60 + rng() * 40) * 10) / 10;
					data =
						era === v1
							? { weight, note: noteText }
							: era === v2
								? { weight, pulse: 50 + Math.floor(rng() * 60), note: noteText }
								: { weight, weight_lb: Math.round(weight * 2.2046 * 10) / 10, note: noteText };
				} else if (kindShare < 0.8) {
					kindId = sleep.id;
					kindVId = sleepV.id;
					data = {
						hours: Math.round((4 + rng() * 6) * 2) / 2,
						quality: rng() < 0.7 ? 'good' : 'poor'
					};
				} else if (kindShare < 0.9) {
					kindId = diary.id;
					kindVId = diaryV.id;
					data = { text: noteText };
				} else {
					kindId = null;
					kindVId = null;
					data = null;
					content = `Запись ${index}`;
				}
				const caseShare = rng();
				let temporalCase: TemporalCase;
				let eventMs = createdMs - Math.floor(rng() * 3 * 86_400_000);
				if (kindVId === v3.id && caseShare < 0.05) {
					// Made under the newest version, about an event of the first version's era.
					temporalCase = 'backdated';
					eventMs = ERA_START + Math.floor(rng() * 0.15 * (ERA_END - ERA_START));
				} else if (caseShare < 0.06) temporalCase = 'undated';
				else if (caseShare < 0.14) temporalCase = 'day';
				else if (caseShare < 0.18) temporalCase = 'month';
				else if (caseShare < 0.2) temporalCase = 'year';
				else if (caseShare < 0.23) temporalCase = 'approximate';
				else if (caseShare < 0.25) temporalCase = 'duration';
				else if (caseShare < 0.27) temporalCase = 'interval';
				else temporalCase = 'minute';
				const minute = new Date(Math.floor(eventMs / 60_000) * 60_000).toISOString();
				let aboutKind: 'instant' | 'interval' = 'instant';
				let aboutTime: TraceAboutTime;
				let statedDuration: { amount: number; unit: 'minute' | 'day' } | null = null;
				switch (temporalCase) {
					case 'undated':
						aboutTime = { basis: 'unknown' };
						break;
					case 'day':
						aboutTime = {
							basis: 'absolute',
							precision: 'day',
							certainty: 'exact',
							start: day(eventMs),
							end: null
						};
						break;
					case 'month':
						aboutTime = {
							basis: 'absolute',
							precision: 'month',
							certainty: 'exact',
							start: month(eventMs),
							end: null
						};
						break;
					case 'year':
						aboutTime = {
							basis: 'absolute',
							precision: 'year',
							certainty: 'exact',
							start: year(eventMs),
							end: null
						};
						break;
					case 'approximate':
						aboutTime = {
							basis: 'absolute',
							precision: 'minute',
							certainty: 'approximate',
							start: minute,
							end: null
						};
						break;
					case 'duration':
						// An amount locates the start of an interval; no end is invented for it.
						aboutKind = 'interval';
						aboutTime = {
							basis: 'absolute',
							precision: 'minute',
							certainty: 'exact',
							start: minute,
							end: null
						};
						statedDuration = { amount: 45, unit: 'minute' };
						break;
					case 'interval':
						aboutKind = 'interval';
						aboutTime = {
							basis: 'absolute',
							precision: 'day',
							certainty: 'exact',
							start: day(eventMs),
							end: day(eventMs + 2 * 86_400_000)
						};
						break;
					default:
						aboutTime = {
							basis: 'absolute',
							precision: 'minute',
							certainty: 'exact',
							start: minute,
							end: null
						};
				}
				if (kindId === null) temporalCase = 'plain';
				if (samples[temporalCase].length < 20) samples[temporalCase].push(id);
				const createdAt = new Date(createdMs).toISOString();
				// Every tenth row is stored in the rewritten shape, as an edited row would be.
				const rewritten = index % 10 === 9;
				const row: Record<string, unknown> = {
					id,
					capturedAt: createdAt,
					timezone: 'UTC',
					aboutKind,
					...(rewritten ? { aboutTime: [aboutTime] } : { aboutTime }),
					...exactTraceTimeProjection(aboutKind, aboutTime),
					statedDuration,
					aboutTraceId: null,
					content,
					description: null,
					relation: rng() < 0.15 ? 'intend' : 'actual',
					kindId,
					kindVId,
					...(rewritten && data !== null ? { data: [data] } : { data }),
					...(rewritten
						? {
								encoding: {
									aboutTime: TRACE_FIELD_ENCODING,
									...(data !== null ? { data: TRACE_FIELD_ENCODING } : {})
								}
							}
						: {}),
					isDeleted: index % 500 === 499,
					createdAt,
					updatedAt: createdAt
				};
				await transaction.insert('traces', row as never);
				if (kindVId) byVersion[kindVId] = (byVersion[kindVId] ?? 0) + 1;
				const membershipShare = rng();
				const count = membershipShare < 0.1 ? 0 : membershipShare < 0.7 ? 1 : 2;
				for (let m = 0; m < count; m += 1) {
					const scope = scopes[(index + m * 2) % scopes.length];
					memberships += 1;
					await transaction.insert('intersections', {
						id: `${id}:${scope.id}:belongs_to`,
						fromId: id,
						toId: scope.id,
						kind: 'belongs_to',
						isDeleted: false,
						createdAt,
						updatedAt: createdAt
					} as never);
				}
			}
		});
	}
	return {
		kinds: { measure, sleep, diary },
		versions: { v1, v2, v3, sleep: sleepV, diary: diaryV },
		scopes,
		samples,
		counts: { traces: rows, memberships, byVersion },
		seedMs: Math.round(performance.now() - started)
	};
};
