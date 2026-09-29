import { expect, it } from 'vitest';
import { assertTraceData } from '$lib/state/triplit/trace-kind-v-validation';
import type { JsonObject } from '$lib/state/triplit/types';
import { formatFormValue, traceFormDisplay } from './display';
import { scalar } from './receipt.fixture';
import { compileTraceForm } from './schema';

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

it('reads a list of rows in one line: sets joined by «+», a set of several values by «×»', () => {
	const exercise = scalar('ex', 'Упражнение', 'choice', true, ['Подтягивания', 'Жим', 'Бег']);
	const [pull, press, run] = exercise.options;
	pull.shows = ['sets'];
	press.shows = ['sets'];
	run.shows = ['time', 'dist'];
	const weight = { ...scalar('kg', 'Вес', 'number', false), unit: 'кг' };
	const definition = compileTraceForm({
		name: 'Утренняя физуха',
		fields: [
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
						fields: [weight, scalar('reps', 'Повторы', 'integer', false)]
					},
					{ ...scalar('time', 'Время', 'number'), unit: 'мин' },
					{ ...scalar('dist', 'Дистанция', 'number', false), unit: 'км' }
				]
			}
		]
	});
	const display = traceFormDisplay(definition, {
		uprazhneniya: [
			{ uprazhnenie: 'podtyagivaniya', podhody: [{ povtory: 10 }, { povtory: 7 }] },
			{
				uprazhnenie: 'zhim',
				podhody: [
					{ ves: 60, povtory: 8 },
					{ ves: 60, povtory: 6 }
				]
			},
			{ uprazhnenie: 'beg', vremya: 18, distantsiya: 3 }
		]
	});
	expect(display.conciseFields).toEqual([
		{
			label: 'Упражнения',
			value: 'Подтягивания 10+7 · Жим 60 кг×8+60 кг×6 · Бег 18 мин, 3 км'
		}
	]);
	expect(display.displayTitle).toBe(
		'Утренняя физуха · Упражнения: Подтягивания 10+7 · Жим 60 кг×8+60 кг×6 · Бег 18 мин, 3 км'
	);
	// A record without rows says nothing about the list.
	expect(traceFormDisplay(definition, { uprazhneniya: [] }).conciseFields).toEqual([]);
});

it('names what a set adds past its first two values, so «×8» never reads as a third factor', () => {
	const lift = { ...scalar('w', 'Вес', 'number'), unit: 'кг' };
	const definition = compileTraceForm({
		name: 'Зал',
		fields: [
			{
				id: 'list',
				label: 'Упражнения',
				kind: 'repeating',
				required: true,
				fields: [
					scalar('x', 'Упражнение', 'text'),
					{
						id: 'sets',
						label: 'Подходы',
						kind: 'repeating',
						required: true,
						fields: [
							lift,
							scalar('r', 'Повторы', 'integer'),
							scalar('e', 'Усилие (RPE)', 'integer')
						]
					}
				]
			}
		]
	});
	const data: JsonObject = {
		uprazhneniya: [
			{
				uprazhnenie: 'Жим',
				podhody: [
					{ ves: 100, povtory: 5, usilie_rpe: 8 },
					{ ves: 100, povtory: 5 }
				]
			}
		]
	};
	expect(traceFormDisplay(definition, data).conciseFields[0]?.value).toBe(
		'Жим 100 кг×5 (Усилие 8)+100 кг×5'
	);
});
