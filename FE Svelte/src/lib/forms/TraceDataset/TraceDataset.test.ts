import { describe, expect, it } from 'vitest';
import type { TraceKindV } from '$lib/state/triplit/types';
import { traceSchemaProjections } from '$lib/model/TraceForm/projections';
import {
	columnsRequest,
	composeFilter,
	datasetCell,
	defaultColumnKeys,
	describeFilter,
	filterFields,
	filterOperators
} from './model';

const version = (id: string, generation: number, unit?: string): TraceKindV => ({
	id,
	kindId: 'kind',
	generation,
	parentKindVIds: [],
	dataSchema: {
		type: 'object',
		properties: {
			weight: { type: 'number', title: generation > 1 ? 'Масса' : 'Вес' },
			note: { type: 'string', title: 'Заметка' },
			...(generation > 1
				? { mood: { type: 'string', title: 'Настроение', oneOf: [{ const: 'ok', title: 'Норм' }] } }
				: {})
		}
	},
	uiSchema: { note: { 'ui:components': { textWidget: 'textareaWidget' } } },
	fieldMeta: unit ? { '/properties/weight': { unit: { id: unit, label: unit } } } : {},
	createdAt: `2026-0${generation}-08T00:00:00Z`,
	createdByDeviceId: 'test'
});

describe('the table of one version', () => {
	it('shows every scalar field but multi-line text until the user chooses, dates by their value', () => {
		const v1 = version('a', 1, 'kg');
		const projection = traceSchemaProjections(v1.dataSchema)[0];
		expect(defaultColumnKeys(projection, v1)).toEqual(['about_at', 'root_0']);
		expect(columnsRequest(projection, ['about_at', 'root_1'])).toEqual([
			{ key: 'about_at', source: 'core', field: 'aboutDate' },
			{ key: 'root_1', source: 'data', path: ['note'], expectedType: 'string' }
		]);
		const row = { traceId: 't', kindVId: 'a', values: { root_0: 74, about_at: '2026-03-05' } };
		expect(datasetCell(row, projection.columns[1], projection, [v1])).toBe('74 kg');
		expect(datasetCell(row, projection.columns[0], projection, [v1])).toContain('2026');
		expect(datasetCell({ ...row, values: {} }, projection.columns[1], projection, [v1])).toBe('—');
	});

	it('names the filter fields by stable key, as the newest version labels them', () => {
		const fields = filterFields([version('a', 1), version('b', 2)]);
		expect(fields.map((field) => [field.key, field.label, field.type])).toEqual([
			['weight', 'Масса', 'number'],
			['note', 'Заметка', 'string'],
			['mood', 'Настроение', 'string']
		]);
		expect(
			describeFilter(
				{ path: ['weight'], expectedType: 'number', operator: '>=', value: 70 },
				fields
			)
		).toBe('Масса >= 70');
		expect(
			describeFilter({ path: ['mood'], expectedType: 'string', operator: '=', value: 'ok' }, fields)
		).toBe('Настроение = Норм');
		expect(
			describeFilter(
				{ path: ['note'], expectedType: 'string', operator: 'like', value: '%утро%' },
				fields
			)
		).toBe('Заметка ∋ утро');
	});

	it('composes a condition only from what its control shows', () => {
		const number = { key: 'hours', path: ['hours'], label: 'Часы', type: 'number' } as const;
		const yesNo = { key: 'deep', path: ['deep'], label: 'Глубокий сон', type: 'boolean' } as const;
		const choice = {
			key: 'quality',
			path: ['quality'],
			label: 'Качество',
			type: 'string',
			choices: { good: 'Хороший', bad: 'Плохой' }
		} as const;
		const text = { key: 'note', path: ['note'], label: 'Заметка', type: 'string' } as const;
		// A value typed for a number field is nothing for a yes/no or a choice field.
		expect(composeFilter(number, '>', '7')).toEqual({
			path: ['hours'],
			expectedType: 'number',
			operator: '>',
			value: 7
		});
		expect(composeFilter(number, '=', '0')).toEqual({
			path: ['hours'],
			expectedType: 'number',
			operator: '=',
			value: 0
		});
		expect(composeFilter(number, '=', '')).toBeNull();
		expect(composeFilter(number, '=', 'семь')).toBeNull();
		expect(composeFilter(yesNo, '=', '7')).toBeNull();
		expect(composeFilter(yesNo, '=', '')).toBeNull();
		expect(composeFilter(yesNo, '=', 'true')).toEqual({
			path: ['deep'],
			expectedType: 'boolean',
			operator: '=',
			value: true
		});
		expect(composeFilter(yesNo, '=', 'false')).toEqual({
			path: ['deep'],
			expectedType: 'boolean',
			operator: '=',
			value: false
		});
		expect(composeFilter(choice, '=', 'кое-что')).toBeNull();
		expect(composeFilter(choice, '=', '')).toBeNull();
		expect(composeFilter(choice, '=', 'bad')).toEqual({
			path: ['quality'],
			expectedType: 'string',
			operator: '=',
			value: 'bad'
		});
		expect(composeFilter(text, 'like', ' утро ')).toEqual({
			path: ['note'],
			expectedType: 'string',
			operator: 'like',
			value: '%утро%'
		});
		expect(composeFilter(undefined, '=', 'x')).toBeNull();
		expect([
			filterOperators(number)[0],
			filterOperators(text)[0],
			filterOperators(yesNo),
			filterOperators(choice)
		]).toEqual(['=', 'like', ['='], ['=']]);
		expect(
			describeFilter(
				{ path: ['deep'], expectedType: 'boolean', operator: '=', value: false },
				[yesNo],
				{ yes: 'да', no: 'нет' }
			)
		).toBe('Глубокий сон = нет');
	});
});
