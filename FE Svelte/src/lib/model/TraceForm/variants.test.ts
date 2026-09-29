import { describe, expect, it } from 'vitest';
import { assertTraceData } from '$lib/state/triplit/trace-kind-v-validation';
import type { JsonObject } from '$lib/state/triplit/types';
import { formSchema, variantKey } from './conditions';
import { traceFormDisplay } from './display';
import { traceSchemaProjections } from './projections';
import { scalar } from './receipt.fixture';
import { compileTraceForm } from './schema';
import { decodeTraceForm } from './TraceForm';
import type { TraceFieldDraft, TraceVariantsFieldDraft } from './types';
import { listVariants } from '$lib/forms/TraceForms/List/list';

const sets = (id: string, fields: TraceFieldDraft[]): TraceFieldDraft => ({
	id,
	label: 'Подходы',
	kind: 'repeating',
	required: true,
	fields
});
/** The owner's morning: each exercise brings its own fields, no condition written by hand. */
const morning = (): TraceVariantsFieldDraft => ({
	id: 'list',
	label: 'Упражнения',
	kind: 'variants',
	required: true,
	choiceLabel: 'Упражнение',
	choiceId: 'ex',
	variants: [
		{ id: 'push', label: 'Отжимания', fields: [sets('s1', [scalar('r1', 'Повторы', 'integer')])] },
		{
			id: 'run',
			label: 'Бег',
			fields: [
				{ ...scalar('t', 'Время', 'number'), unit: 'мин' },
				{ ...scalar('d', 'Дистанция', 'number', false), unit: 'км' }
			]
		},
		{
			id: 'lift',
			label: 'Становая тяга',
			fields: [
				sets('s2', [
					{ ...scalar('w', 'Вес', 'number'), unit: 'кг' },
					scalar('r2', 'Повторы', 'integer')
				])
			]
		}
	]
});
const data: JsonObject = {
	uprazhneniya: [
		{ uprazhnenie: 'otzhimaniya', podhody: [{ povtory: 15 }, { povtory: 12 }] },
		{
			uprazhnenie: 'stanovaya_tyaga',
			podhody_2: [
				{ ves: 100, povtory: 5 },
				{ ves: 100, povtory: 5 }
			]
		},
		{ uprazhnenie: 'beg', vremya: 18, distantsiya: 3 }
	]
};

describe('a list of variants, each with its own fields', () => {
	const compiled = compileTraceForm({ name: 'Утренняя физуха', fields: [morning()] });

	it('is stored as a list with a choice and its conditions, and takes the owner’s morning', () => {
		const row = ((compiled.dataSchema.properties as JsonObject).uprazhneniya as JsonObject)
			.items as JsonObject;
		expect(Object.keys(row.properties as JsonObject)).toEqual([
			'uprazhnenie',
			'podhody',
			'vremya',
			'distantsiya',
			'podhody_2'
		]);
		expect(() => assertTraceData(data, compiled.dataSchema)).not.toThrow();
		// A run holds no sets, whatever the form kept while it was being typed.
		expect(() =>
			assertTraceData(
				{ uprazhneniya: [{ uprazhnenie: 'beg', vremya: 18, podhody: [{ povtory: 1 }] }] },
				compiled.dataSchema
			)
		).toThrow();
	});

	it('reads back as the same variants, and compiles again into the same schema', () => {
		const draft = decodeTraceForm('Утренняя физуха', compiled);
		const list = draft.fields[0] as TraceVariantsFieldDraft;
		expect(list.kind).toBe('variants');
		expect(list.choiceLabel).toBe('Упражнение');
		expect(
			list.variants.map((variant) => [variant.label, variant.fields.map((f) => f.label)])
		).toEqual([
			['Отжимания', ['Подходы']],
			['Бег', ['Время', 'Дистанция']],
			['Становая тяга', ['Подходы']]
		]);
		expect(compileTraceForm(draft).dataSchema).toEqual(compiled.dataSchema);
	});

	it('reads in one line and names each variant’s own table', () => {
		expect(traceFormDisplay(compiled, data).conciseFields[0]?.value).toBe(
			'Отжимания 15+12 · Становая тяга 100 кг×5+100 кг×5 · Бег 18 мин, 3 км'
		);
		expect(
			traceSchemaProjections(compiled.dataSchema).map((projection) => projection.title)
		).toEqual([
			'Записи',
			'Упражнения',
			'Упражнения / Отжимания / Подходы',
			'Упражнения / Становая тяга / Подходы'
		]);
	});

	it('is known as variants both where it is stored and where the form draws it', () => {
		const list = (compiled.dataSchema.properties as JsonObject).uprazhneniya as JsonObject;
		expect(variantKey(list.items as JsonObject)).toBe('uprazhnenie');
		const drawn = (formSchema(compiled.dataSchema).properties as JsonObject).uprazhneniya;
		expect((drawn as JsonObject).minItems).toBeUndefined();
		expect(list.minItems).toBe(1);
		expect(listVariants(drawn)).toEqual({
			key: 'uprazhnenie',
			title: 'Упражнение',
			options: [
				{ value: 'otzhimaniya', title: 'Отжимания' },
				{ value: 'beg', title: 'Бег' },
				{ value: 'stanovaya_tyaga', title: 'Становая тяга' }
			]
		});
	});
});
