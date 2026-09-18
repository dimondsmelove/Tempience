import { describe, expect, it } from 'vitest';
import type { JsonObject, TraceKind, TraceKindV } from '$lib/state/triplit/types';
import { conciseValues, traceSummary, type SummaryTrace } from './summary';

const kind = (id: string, name: string): TraceKind =>
	({ id, name, createdAt: '', updatedAt: '', isDeleted: false }) as unknown as TraceKind;

const version = (id: string, kindId: string, schema: JsonObject): TraceKindV =>
	({
		id,
		kindId,
		generation: 1,
		parentKindVIds: [],
		dataSchema: schema,
		createdAt: '',
		createdByDeviceId: ''
	}) as TraceKindV;

const weightSchema = (title?: string): JsonObject => ({
	type: 'object',
	...(title ? { title } : {}),
	properties: {
		weight: { type: 'number', title: 'Вес' },
		note: { type: 'string', title: 'Заметка' }
	}
});

const typed = (patch: Partial<SummaryTrace> = {}): SummaryTrace => ({
	content: '',
	kindId: 'k',
	kindVId: 'v',
	data: { weight: 74.5, note: 'После прогулки' },
	...patch
});

const catalog = (schema: JsonObject = weightSchema()) => ({
	kinds: [kind('k', 'Замер веса')],
	versions: [version('v', 'k', schema)]
});

describe('trace summary (P1)', () => {
	it('reads a plain record as its own title and description', () => {
		const summary = traceSummary({ content: 'Прогулка', description: '  у реки  ', kindId: null });
		expect(summary).toEqual({
			title: 'Прогулка',
			description: 'у реки',
			values: [],
			fields: [],
			diagnostic: null
		});
	});

	it('names a typed record by its Kind and keeps its own values apart from its comment', () => {
		const summary = traceSummary(typed({ content: 'После обеда' }), catalog());
		expect(summary.title).toBe('Замер веса');
		expect(summary.description).toBe('После обеда');
		expect(summary.values).toEqual([
			{ label: 'Вес', value: '74,5' },
			{ label: 'Заметка', value: 'После прогулки' }
		]);
		expect(summary.diagnostic).toBeNull();
	});

	it('prefers the schema title when it has one, and never leaves a typed row unnamed', () => {
		expect(traceSummary(typed(), catalog(weightSchema('Масса тела'))).title).toBe('Масса тела');
		// An empty own comment is not a label: the Kind still names the record.
		const empty = traceSummary(typed({ content: '' }), catalog());
		expect([empty.title, empty.description]).toEqual(['Замер веса', null]);
	});

	it('says what it could not read while keeping the record itself', () => {
		const noVersion = traceSummary(typed({ kindVId: 'gone' }), catalog());
		expect([noVersion.title, noVersion.diagnostic]).toEqual(['Замер веса', 'version']);
		const noKind = traceSummary(typed({ kindId: 'other' }), catalog());
		expect([noKind.title, noKind.diagnostic]).toEqual([null, 'kind']);
		// A schema the formatter cannot walk leaves the stored values in place.
		const broken = traceSummary(typed(), {
			kinds: catalog().kinds,
			versions: [version('v', 'k', { type: 'object', properties: null as never })]
		});
		expect([broken.title, broken.values.length]).toEqual(['Замер веса', 0]);
	});

	it('uses the snapshot enrichment when no catalog is given', () => {
		const enriched = traceSummary({
			content: '',
			kindId: 'k',
			kindLabel: 'Замер веса',
			displayFields: [{ label: 'Вес', value: '74,5 кг' }]
		});
		expect([enriched.title, enriched.values.length, enriched.diagnostic]).toEqual([
			'Замер веса',
			1,
			null
		]);
		// Without enrichment and without a catalog the row says the version is unreadable.
		expect(traceSummary({ content: '', kindId: 'k' }).diagnostic).toBe('version');
	});

	it('keeps a row short with the first own values', () => {
		const summary = traceSummary(typed(), catalog());
		expect(conciseValues(summary, 1)).toEqual([{ label: 'Вес', value: '74,5' }]);
	});
});
