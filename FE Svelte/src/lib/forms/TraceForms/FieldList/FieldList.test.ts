import { describe, expect, it } from 'vitest';
import { compileTraceForm } from '$lib/model/TraceForm/schema';
import { readConditions } from '$lib/model/TraceForm/conditions';
import { scalar } from '$lib/model/TraceForm/receipt.fixture';
import type { JsonObject } from '$lib/state/triplit/types';
import type { TraceFieldDraft } from '$lib/model/TraceForm/types';
import { previewDraft } from './preview';
import { controllersFor, setVisibility, visibilityOf } from './visibility';

const row = (): TraceFieldDraft[] => [
	scalar('ex', 'Упражнение', 'choice', false, ['Подтягивания', 'Бег']),
	{
		id: 'sets',
		label: 'Подходы',
		kind: 'repeating',
		required: false,
		fields: [scalar('reps', 'Повторы', 'integer')]
	},
	scalar('time', 'Время', 'number', false)
];

describe('when a field is shown, set on the field itself', () => {
	it('is always, until a choice beside it decides; the choice becomes required', () => {
		const fields = row();
		const [ex, , time] = fields;
		expect(controllersFor(fields, time).map((field) => field.id)).toEqual(['ex']);
		expect(visibilityOf(fields, time)).toBeNull();
		setVisibility(fields, 'time', { controllerId: 'ex', optionIds: ['ex:option:1'] });
		expect(visibilityOf(fields, time)).toEqual({ controllerId: 'ex', optionIds: ['ex:option:1'] });
		expect(ex.required).toBe(true);
		// The compiler reads the same model: «Бег» shows the time and hides it elsewhere.
		setVisibility(fields, 'sets', { controllerId: 'ex', optionIds: ['ex:option:0'] });
		const schema = compileTraceForm({ name: 'Физуха', fields }).dataSchema;
		expect(readConditions(schema)?.map((c) => [c.value, c.shown, c.hidden])).toEqual([
			['podtyagivaniya', ['podhody'], ['vremya']],
			['beg', ['vremya'], ['podhody']]
		]);
	});

	it('goes back to always, and names the field in no option any more', () => {
		const fields = row();
		setVisibility(fields, 'time', { controllerId: 'ex', optionIds: ['ex:option:1'] });
		setVisibility(fields, 'time', null);
		expect(visibilityOf(fields, fields[2])).toBeNull();
		expect(fields[0].kind === 'choice' && fields[0].options.every((o) => !o.shows?.length)).toBe(
			true
		);
	});
});

describe('the live preview of a draft', () => {
	const words = {
		kind: 'Новый Trace Kind',
		field: (n: number) => `Поле ${n}`,
		option: (n: number) => `Вариант ${n}`
	};

	it('compiles while fields and options are still unnamed, and leaves out a list without fields', () => {
		const draft = {
			name: '',
			fields: [
				{ ...scalar('a', '', 'choice', true, ['', 'Бег']) },
				{ id: 'l', label: 'Пусто', kind: 'repeating' as const, required: false, fields: [] }
			]
		};
		const preview = previewDraft(draft, words);
		const schema = compileTraceForm(preview).dataSchema as JsonObject;
		expect(schema.title).toBe('Новый Trace Kind');
		expect(Object.keys(schema.properties as JsonObject)).toEqual(['pole_1']);
		// The draft itself keeps what the user typed.
		expect(draft.fields[0].label).toBe('');
	});
});
