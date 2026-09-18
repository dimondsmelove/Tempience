import { expect, it } from 'vitest';
import { assertTraceData } from '$lib/state/triplit/trace-kind-v-validation';
import { formatFormValue, traceFormDisplay } from './display';

it('derives readable titles from the pinned schema, units and option labels without rewriting content', () => {
	const definition = {
		dataSchema: {
			type: 'object',
			title: 'Замер',
			properties: {
				weight: { type: 'number', title: 'Вес' },
				tags: {
					type: 'array',
					title: 'Метки',
					items: { type: 'string', oneOf: [{ const: 'a', title: 'Утро' }] }
				}
			}
		},
		fieldMeta: { '/properties/weight': { unit: { id: 'kg', label: 'кг' } } }
	};
	expect(traceFormDisplay(definition, { weight: 73.8, tags: ['a'] })).toMatchObject({
		displayTitle: 'Замер · Вес: 73,8 кг · Метки: Утро'
	});
	expect(traceFormDisplay(definition, {}).displayTitle).toBe('Замер');
});

it.each(['2026-09-09t10:00:00z', '2026-09-09T10:00:00.123456Z'])(
	'formats JSON Schema date-time %s without applying the Trace time contract',
	(when) => {
		const definition = {
			dataSchema: { type: 'object', properties: { when: { type: 'string', format: 'date-time' } } }
		};
		expect(() => assertTraceData({ when }, definition.dataSchema)).not.toThrow();
		expect(traceFormDisplay(definition, { when }).displayFields).toEqual([
			{
				label: 'when',
				value: new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
					new Date('2026-09-09T10:00:00Z')
				)
			}
		]);
	}
);

it.each([
	['not-a-date', 'date-time'],
	['2026-02-30', 'date'],
	['2026-02-30T10:00:00Z', 'date-time'],
	['2016-12-31T23:59:60Z', 'date-time']
])('preserves unrenderable date value %s without normalizing or throwing', (value, format) => {
	expect(formatFormValue(value, { type: 'string', format })).toBe(value);
});

it('keeps date-only fields on their calendar day regardless of the local timezone', () => {
	expect(formatFormValue('2026-09-09', { format: 'date' })).toBe(
		new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeZone: 'UTC' }).format(
			new Date('2026-09-09')
		)
	);
});
