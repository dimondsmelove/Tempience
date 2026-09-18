import { describe, expect, it } from 'vitest';
import { traceSchemaProjections } from './projections';
import { receiptFields, scalar } from './receipt.fixture';
import { compileTraceDataSchema } from './schema';

describe('the table projections of a schema', () => {
	it('describes repeated rows as a dataset projection without changing Trace granularity', () => {
		const schema = compileTraceDataSchema('Поход в магазин', receiptFields);
		const projections = traceSchemaProjections(schema);
		expect(projections).toHaveLength(1);
		expect(projections[0]).toMatchObject({
			id: 'repeat:tovary',
			title: 'Товары',
			repeat: { path: ['tovary'] }
		});
		expect(projections[0]?.columns.map(({ label, column }) => [label, column.source])).toEqual([
			['Дата и время', 'core'],
			['Магазин', 'data'],
			['Название', 'item'],
			['Сумма', 'item'],
			['Валюта', 'item'],
			['Категория', 'item'],
			['Заметка', 'item']
		]);
		expect(projections[0]?.columns[4]?.valueLabels).toEqual({ rsd: 'RSD', eur: 'EUR' });
		expect(projections[0]?.columns[5]?.valueLabels).toEqual({
			produkty: 'Продукты',
			byt: 'Быт'
		});
	});

	it('gives a schema without a repeated group one projection of its own scalars', () => {
		const schema = compileTraceDataSchema('Замер', [
			scalar('weight', 'Вес', 'number'),
			scalar('mood', 'Настроение', 'choice', false, ['Норм'])
		]);
		const [only, ...rest] = traceSchemaProjections(schema);
		expect(rest).toEqual([]);
		expect(only.repeat).toBeUndefined();
		expect(only.columns.map(({ label, column }) => [label, column.source])).toEqual([
			['Дата и время', 'core'],
			['Вес', 'data'],
			['Настроение', 'data']
		]);
		expect(only.columns[2]?.valueLabels).toEqual({ norm: 'Норм' });
	});
});
