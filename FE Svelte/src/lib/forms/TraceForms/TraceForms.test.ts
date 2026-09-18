import { describe, expect, it } from 'vitest';
import { formUiSchema } from './runtime';
import type { TraceKindVDraft } from '$lib/state/triplit/types';

describe('form runtime presentation', () => {
	it('adds measurement labels to nested form UI without mutating the versioned contract', () => {
		const definition: TraceKindVDraft = {
			dataSchema: {
				type: 'object',
				properties: {
					rows: {
						type: 'array',
						items: { type: 'object', properties: { amount: { type: 'number', title: 'Сумма' } } }
					}
				}
			},
			fieldMeta: {
				'/properties/rows/items/properties/amount': { unit: { id: 'rsd', label: 'RSD' } }
			}
		};
		const before = structuredClone(definition);
		expect(formUiSchema(definition)).toMatchObject({
			rows: { items: { amount: { 'ui:options': { title: 'Сумма, RSD' } } } }
		});
		expect(definition).toEqual(before);
	});
});
