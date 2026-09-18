import { describe, expect, it } from 'vitest';
import { CodedError } from '$lib/model/Errors/CodedError';
import {
	assertTraceData,
	assertTraceKindVSchema
} from '$lib/state/triplit/trace-kind-v-validation';
import { receiptFields, scalar } from './receipt.fixture';
import { compileTraceDataSchema } from './schema';

describe('the data schema of a form', () => {
	it('compiles a repeated receipt group into a strict Draft-07 schema', () => {
		const schema = compileTraceDataSchema('Поход в магазин', receiptFields);
		assertTraceKindVSchema(schema);
		expect(schema).toMatchObject({
			title: 'Поход в магазин',
			type: 'object',
			additionalProperties: false,
			required: ['tovary'],
			properties: {
				magazin: { type: 'string', title: 'Магазин' },
				tovary: {
					type: 'array',
					minItems: 1,
					items: {
						type: 'object',
						additionalProperties: false,
						required: ['nazvanie', 'summa', 'valyuta', 'kategoriya'],
						properties: {
							valyuta: {
								type: 'string',
								oneOf: [
									{ const: 'rsd', title: 'RSD' },
									{ const: 'eur', title: 'EUR' }
								]
							}
						}
					}
				}
			}
		});
		const rows = [
			{ nazvanie: 'Молоко', summa: 180, valyuta: 'rsd', kategoriya: 'produkty' },
			{ nazvanie: 'Кофе', summa: 620, valyuta: 'rsd', kategoriya: 'produkty', zametka: 'Новый' }
		];
		expect(() => assertTraceData({ magazin: 'Maxi', tovary: rows }, schema)).not.toThrow();
		// A number written as text, a required group left empty and an unknown key are refused.
		const refused = 'Trace data does not match TraceKindV';
		expect(() => assertTraceData({ tovary: [{ ...rows[0], summa: '180' }] }, schema)).toThrow(
			refused
		);
		expect(() => assertTraceData({ magazin: 'Maxi', tovary: [] }, schema)).toThrow(refused);
		expect(() => assertTraceData({ magazin: 'Maxi', tovary: rows, extra: 1 }, schema)).toThrow(
			refused
		);
	});

	it('keeps duplicate human labels addressable with unique generated keys', () => {
		const schema = compileTraceDataSchema('Проверка', [
			scalar('first', 'Оценка', 'number'),
			scalar('second', 'Оценка', 'text')
		]);
		expect(Object.keys(schema.properties as object)).toEqual(['otsenka', 'otsenka_2']);
	});

	it('rejects incomplete choice and repeated-group drafts before persistence, by code', () => {
		const code = (run: () => unknown): unknown => {
			try {
				run();
			} catch (cause) {
				return cause instanceof CodedError ? [cause.code, cause.details] : cause;
			}
			return 'accepted';
		};
		expect(
			code(() => compileTraceDataSchema('Тип', [scalar('choice', 'Статус', 'choice')]))
		).toEqual(['form_choice_options', { field: 'Статус' }]);
		expect(
			code(() =>
				compileTraceDataSchema('Тип', [
					{ id: 'rows', kind: 'repeating', label: 'Строки', required: true, fields: [] }
				])
			)
		).toEqual(['form_fields_empty', {}]);
		expect(code(() => compileTraceDataSchema('Тип', [scalar('blank', ' ', 'text')]))).toEqual([
			'form_label_required',
			{ reason: 'field', field: undefined }
		]);
	});
});
