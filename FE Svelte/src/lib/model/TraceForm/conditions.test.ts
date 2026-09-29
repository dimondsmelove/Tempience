import { describe, expect, it } from 'vitest';
import { assertTraceData } from '$lib/state/triplit/trace-kind-v-validation';
import type { JsonObject } from '$lib/state/triplit/types';
import { formSchema, readConditions, withoutHidden } from './conditions';
import { scalar } from './receipt.fixture';
import { compileTraceForm } from './schema';
import { decodeTraceForm } from './TraceForm';
import type { TraceFieldDraft, TraceScalarFieldDraft } from './types';

/** «Утренняя физуха» as the owner builds it: the exercise decides what its row asks for. */
function morning(): TraceFieldDraft[] {
	const exercise = scalar('ex', 'Упражнение', 'choice', true, ['Подтягивания', 'Брусья', 'Бег']);
	const [pull, dips, run] = exercise.options;
	pull.shows = ['sets'];
	dips.shows = ['sets'];
	run.shows = ['time', 'dist'];
	return [
		{
			id: 'list',
			label: 'Упражнения',
			kind: 'repeating',
			required: true,
			fields: [
				exercise,
				{
					id: 'sets',
					label: 'Подходы',
					kind: 'repeating',
					required: true,
					fields: [scalar('reps', 'Повторы', 'integer')]
				},
				scalar('time', 'Время', 'number'),
				scalar('dist', 'Дистанция', 'number', false)
			]
		}
	];
}
const rowOf = (schema: JsonObject) =>
	((schema.properties as JsonObject).uprazhneniya as JsonObject).items as JsonObject;

describe('fields a choice shows', () => {
	const compiled = compileTraceForm({ name: 'Утренняя физуха', fields: morning() });
	const row = rowOf(compiled.dataSchema);

	it('keeps every field in the row and says per option which are shown, hidden and required', () => {
		expect(Object.keys(row.properties as JsonObject)).toEqual([
			'uprazhnenie',
			'podhody',
			'vremya',
			'distantsiya'
		]);
		// Controlled fields leave the row's own `required`; the deciding choice stays in it.
		expect(row.required).toEqual(['uprazhnenie']);
		expect(readConditions(row)).toEqual([
			{
				controller: 'uprazhnenie',
				value: 'podtyagivaniya',
				shown: ['podhody'],
				hidden: ['vremya', 'distantsiya'],
				required: ['podhody']
			},
			{
				controller: 'uprazhnenie',
				value: 'brusya',
				shown: ['podhody'],
				hidden: ['vremya', 'distantsiya'],
				required: ['podhody']
			},
			{
				controller: 'uprazhnenie',
				value: 'beg',
				shown: ['vremya', 'distantsiya'],
				hidden: ['podhody'],
				required: ['vremya']
			}
		]);
	});

	it('accepts the owner’s morning and refuses a value the chosen option hides', () => {
		const morningData = {
			uprazhneniya: [
				{ uprazhnenie: 'podtyagivaniya', podhody: [{ povtory: 10 }, { povtory: 7 }] },
				{ uprazhnenie: 'brusya', podhody: [{ povtory: 15 }, { povtory: 10 }] },
				{ uprazhnenie: 'beg', vremya: 18, distantsiya: 3 }
			]
		};
		expect(() => assertTraceData(morningData, compiled.dataSchema)).not.toThrow();
		expect(() =>
			assertTraceData(
				{ uprazhneniya: [{ uprazhnenie: 'beg', vremya: 18, podhody: [] }] },
				compiled.dataSchema
			)
		).toThrow();
		expect(() =>
			assertTraceData({ uprazhneniya: [{ uprazhnenie: 'brusya' }] }, compiled.dataSchema)
		).toThrow();
	});

	it('reads back into the same draft, and compiles again into the same schema', () => {
		const draft = decodeTraceForm('Утренняя физуха', compiled);
		const list = draft.fields[0] as Extract<TraceFieldDraft, { kind: 'repeating' }>;
		const exercise = list.fields[0] as TraceScalarFieldDraft;
		const id = (key: string) => `/properties/uprazhneniya/items/properties/${key}`;
		expect(exercise.required).toBe(true);
		expect(exercise.options.map((option) => option.shows)).toEqual([
			[id('podhody')],
			[id('podhody')],
			[id('vremya'), id('distantsiya')]
		]);
		expect(list.fields.map((field) => field.required)).toEqual([true, true, true, false]);
		expect(compileTraceForm(draft).dataSchema).toEqual(compiled.dataSchema);
	});

	it('draws a controlled field only under the options that show it', () => {
		const form = rowOf(formSchema(compiled.dataSchema));
		expect(Object.keys(form.properties as JsonObject)).toEqual(['uprazhnenie']);
		expect(form.additionalProperties).toBeUndefined();
		const run = (form.allOf as JsonObject[])[2].then as JsonObject;
		expect(Object.keys(run.properties as JsonObject)).toEqual(['vremya', 'distantsiya']);
		expect((run.properties as JsonObject).vremya).toMatchObject({ type: 'number', title: 'Время' });
		expect(run.required).toEqual(['vremya']);
	});

	it('drops what the chosen option hides when the record is saved', () => {
		expect(
			withoutHidden(compiled.dataSchema, {
				uprazhneniya: [
					{ uprazhnenie: 'beg', vremya: 18, podhody: [{ povtory: 3 }] },
					{ uprazhnenie: 'brusya', podhody: [{ povtory: 15 }], vremya: 5 }
				]
			})
		).toEqual({
			uprazhneniya: [
				{ uprazhnenie: 'beg', vremya: 18 },
				{ uprazhnenie: 'brusya', podhody: [{ povtory: 15 }] }
			]
		});
	});

	it('refuses a field shown by two choice fields', () => {
		const fields = morning();
		const row = (fields[0] as Extract<TraceFieldDraft, { kind: 'repeating' }>).fields;
		const other = scalar('where', 'Где', 'choice', true, ['Дома', 'Парк']);
		other.options[0].shows = ['time'];
		row.push(other);
		expect(() => compileTraceForm({ name: 'Физуха', fields })).toThrow(/one choice field/);
	});
});
