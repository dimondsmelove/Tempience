import { describe, expect, it } from 'vitest';
import type { JsonObject, TraceKindVDraft } from '$lib/state/triplit/types';
import { traceFormDisplay } from './display';
import { summaryLeaves, versionSummaries } from './summary-fields';

const measurement = (): TraceKindVDraft => ({
	dataSchema: {
		type: 'object',
		properties: {
			note: { type: 'string', title: 'Заметка' },
			weight: { type: 'number', title: 'Вес' },
			body: {
				type: 'object',
				title: 'Тело',
				properties: { pulse: { type: 'number', title: 'Пульс' }, mood: { type: 'string' } }
			},
			meals: {
				type: 'array',
				items: { type: 'object', properties: { name: { type: 'string' } } }
			},
			tag: { type: 'string', title: 'Метка' }
		}
	} as JsonObject,
	uiSchema: {
		'ui:options': { order: ['weight', 'note', 'body'] },
		note: { 'ui:components': { textWidget: 'textareaWidget' } }
	} as JsonObject,
	fieldMeta: { '/properties/weight': { unit: { id: 'kg', label: 'кг' } } }
});

describe('the leaves a row summary is made of', () => {
	it('takes the first two scalar leaves in the form order, past multi-line text and groups', () => {
		const leaves = summaryLeaves(measurement());
		// The form order puts weight first; the note is multi-line and no row shows it; the group
		// is descended into for its first leaf.
		expect(leaves.map((leaf) => [leaf.path.join('.'), leaf.label, leaf.unit ?? null])).toEqual([
			['weight', 'Вес', 'кг'],
			['body.pulse', 'Тело / Пульс', null]
		]);
	});

	it('skips repeated items, whose values are per item, and stops at two', () => {
		const leaves = summaryLeaves({
			dataSchema: {
				type: 'object',
				properties: {
					meals: {
						type: 'array',
						items: { type: 'object', properties: { name: { type: 'string' } } }
					},
					tag: { type: 'string' },
					mood: { type: 'string' },
					extra: { type: 'string' }
				}
			} as JsonObject
		});
		expect(leaves.map((leaf) => leaf.path.join('.'))).toEqual(['tag', 'mood']);
	});

	it('names the paths a thin read selects per version, each version its own', () => {
		const summaries = versionSummaries([
			{ id: 'v1', ...measurement() },
			{
				id: 'v2',
				dataSchema: {
					type: 'object',
					properties: { weight: { type: 'number' }, steps: { type: 'number' } }
				}
			}
		]);
		expect(
			summaries.map((entry) => [entry.kindVId, entry.paths.map((path) => path.join('.'))])
		).toEqual([
			['v1', ['weight', 'body.pulse']],
			['v2', ['weight', 'steps']]
		]);
	});

	it('shows a thin read of the summary leaves the way the full record is shown', () => {
		const definition = measurement();
		const full = traceFormDisplay(
			definition,
			{
				note: 'Длинная заметка '.repeat(50),
				weight: 74.5,
				body: { pulse: 62, mood: 'ok' },
				meals: [{ name: 'суп' }],
				tag: 'x'
			},
			'Замер'
		);
		const thin = traceFormDisplay(definition, { weight: 74.5, body: { pulse: 62 } }, 'Замер');
		expect(full.displayTitle).toBe('Замер · Вес: 74,5 кг · Тело / Пульс: 62');
		expect(thin.displayTitle).toBe(full.displayTitle);
		expect(thin.conciseFields).toEqual(full.conciseFields);
		// The Context still has every value of the full record, the note included.
		expect(full.displayFields.map((field) => field.label)).toContain('Заметка');
		expect(full.displayFields.length).toBeGreaterThan(full.conciseFields.length);
	});
});
