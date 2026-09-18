import type { TraceFieldDraft, TraceScalarFieldDraft } from './types';

/** A field as the retired builder named it: by label only, its key left to the compiler. */
export const scalar = (
	id: string,
	label: string,
	kind: TraceScalarFieldDraft['kind'],
	required = true,
	options: string[] = []
): TraceScalarFieldDraft => ({
	id,
	label,
	kind,
	required,
	unit: '',
	options: options.map((option, index) => ({ id: `${id}:option:${index}`, label: option }))
});

/** A receipt: a shop and a required repeated group of items with choices inside. */
export const receiptFields: TraceFieldDraft[] = [
	scalar('store', 'Магазин', 'text', false),
	{
		id: 'items',
		kind: 'repeating',
		label: 'Товары',
		required: true,
		fields: [
			scalar('name', 'Название', 'text'),
			scalar('amount', 'Сумма', 'number'),
			scalar('currency', 'Валюта', 'choice', true, ['RSD', 'EUR']),
			scalar('category', 'Категория', 'choice', true, ['Продукты', 'Быт']),
			scalar('note', 'Заметка', 'text', false)
		]
	}
];
