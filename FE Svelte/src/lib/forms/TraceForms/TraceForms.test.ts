import { describe, expect, it } from 'vitest';
import { formUiSchema } from './runtime';
import type { TraceKindVDraft } from '$lib/state/triplit/types';

describe('form runtime presentation', () => {
	it('hides the outer State word title so its widget can place the label after the quadrant', () => {
		const definition: TraceKindVDraft = {
			dataSchema: { type: 'object', properties: { word: { type: 'string', title: 'Слово' } } },
			uiSchema: {
				word: {
					'ui:components': { textWidget: 'stateWordWidget' },
					'ui:options': { stateFields: { energy: 'energy', tension: 'tension', mood: 'mood' } }
				}
			}
		};
		expect(formUiSchema(definition).word).toMatchObject({
			'ui:options': { hideTitle: true }
		});
		expect(definition.uiSchema?.word).not.toHaveProperty('ui:options.hideTitle');
	});

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
