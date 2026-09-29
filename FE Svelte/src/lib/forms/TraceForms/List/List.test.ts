import { describe, expect, it } from 'vitest';
import { formUiSchema } from '../runtime';
import { compactColumns, inlineFieldTitle, inlineItems } from './list';

const sets = {
	type: 'array',
	title: 'Подходы',
	items: {
		type: 'object',
		additionalProperties: false,
		properties: { povtory: { type: 'integer', title: 'Повторы' } }
	}
};
const exercises = {
	type: 'array',
	title: 'Упражнения',
	items: {
		type: 'object',
		additionalProperties: false,
		properties: {
			uprazhnenie: { type: 'string', title: 'Упражнение' },
			podhody: sets,
			vremya: { type: 'number', title: 'Время' }
		}
	}
};

describe('lists of a typed record', () => {
	it('lines up the values of a list whose row is one value, and cards every other row', () => {
		expect(inlineItems(sets)).toBe(true);
		expect(inlineItems(exercises)).toBe(false);
		// A row of one nested list is still a card: its value is not a single input.
		expect(
			inlineItems({ type: 'array', items: { type: 'object', properties: { podhody: sets } } })
		).toBe(false);
		expect(inlineItems({ type: 'array', items: { type: 'string' } })).toBe(false);
		// The form moves a controlled field into its option's branch: one property left, still a card.
		expect(
			inlineItems({
				type: 'array',
				items: { type: 'object', properties: { uprazhnenie: { type: 'string' } }, allOf: [] }
			})
		).toBe(false);
		expect(inlineItems({ type: 'string' })).toBe(false);
	});

	it('leaves the rows of every list, nested ones too, without the «Упражнения-1» title', () => {
		const ui = formUiSchema({
			dataSchema: { type: 'object', properties: { uprazhneniya: exercises } },
			uiSchema: { uprazhneniya: { 'ui:options': { orderable: true } } }
		});
		const rows = (ui.uprazhneniya as { items: Record<string, unknown> }).items;
		expect(rows['ui:options']).toEqual({ hideTitle: true });
		expect((ui.uprazhneniya as Record<string, unknown>)['ui:options']).toEqual({ orderable: true });
		const setRows = (rows.podhody as { items: Record<string, unknown> }).items;
		expect(setRows['ui:options']).toEqual({ hideTitle: true });
	});

	it('names the one field of a line of values, its unit included, never bare numbers', () => {
		const list = {
			type: 'array',
			items: { type: 'object', properties: { dlit: { type: 'number', title: 'Длительность' } } }
		};
		expect(
			inlineFieldTitle(list, { items: { dlit: { 'ui:options': { title: 'Длительность, мин' } } } })
		).toBe('Длительность, мин');
		expect(inlineFieldTitle(list, {})).toBe('Длительность');
		expect(inlineFieldTitle({ type: 'string' }, {})).toBeNull();
	});

	it('lays a row of two or three simple values out as columns, titled once with their units', () => {
		const sets = {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					ves: { type: 'number', title: 'Вес' },
					povtory: { type: 'integer', title: 'Повторы' }
				}
			}
		};
		expect(
			compactColumns(sets, { items: { ves: { 'ui:options': { title: 'Вес, кг' } } } })
		).toEqual(['Вес, кг', 'Повторы']);
		// One value is a line of values; a row with a list or a long text stays a card.
		expect(
			compactColumns(
				{ type: 'array', items: { type: 'object', properties: { a: { type: 'number' } } } },
				{}
			)
		).toBeNull();
		expect(
			compactColumns(sets, {
				items: { ves: { 'ui:components': { textWidget: 'textareaWidget' } } }
			})
		).toBeNull();
	});
});
