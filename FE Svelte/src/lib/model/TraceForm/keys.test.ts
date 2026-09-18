import { describe, expect, it } from 'vitest';
import { machineKeyFromLabel, requiredLabel, uniqueMachineKey } from './keys';

describe('machine keys from human labels', () => {
	it('generates stable hidden machine keys from human labels', () => {
		expect(machineKeyFromLabel('Вес')).toBe('ves');
		expect(machineKeyFromLabel('Дата покупки')).toBe('data_pokupki');
		expect(machineKeyFromLabel('2026')).toBe('field_2026');
		expect(machineKeyFromLabel('💡')).toBe('field');
		expect(machineKeyFromLabel('constructor')).toBe('field_constructor');
	});

	it('keeps duplicate labels apart with a counted suffix, in the order they were named', () => {
		const used = new Set<string>();
		expect(uniqueMachineKey('Оценка', used, 'field')).toBe('otsenka');
		expect(uniqueMachineKey('Оценка', used, 'field')).toBe('otsenka_2');
		expect(uniqueMachineKey('оценка', used, 'field')).toBe('otsenka_3');
		expect(uniqueMachineKey('', used, 'item')).toBe('item');
	});

	it('refuses a blank label where one is required, naming what lacks the name', () => {
		expect(() => requiredLabel('  ', 'field')).toThrow(
			expect.objectContaining({ code: 'form_label_required', details: { reason: 'field' } })
		);
		expect(() => requiredLabel('', 'option', 'Статус')).toThrow(
			expect.objectContaining({ details: { reason: 'option', field: 'Статус' } })
		);
		expect(requiredLabel(' Вес ', 'field')).toBe('Вес');
	});
});
