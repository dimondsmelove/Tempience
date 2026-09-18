import { describe, expect, it, vi } from 'vitest';
import {
	compileTraceForm,
	decodeTraceForm,
	newTraceField,
	assertFieldEvolution
} from './TraceForm';
import { assertTraceData } from '$lib/state/triplit/trace-kind-v-validation';
import { FIELD_KINDS } from './constants';
import type { TraceFieldDraft } from './types';

const configuredField = (kind: TraceFieldDraft['kind']): TraceFieldDraft => {
	const field = newTraceField(kind);
	field.label = `Поле ${kind}`;
	if ('fields' in field) field.fields[0].label = 'Вложенный текст';
	else if (field.options.length)
		field.options.forEach((option, index) => (option.label = `Вариант ${index}`));
	return field;
};

describe('visual form compiler', () => {
	it('creates every field and option over HTTP when randomUUID is unavailable', () => {
		const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
		vi.stubGlobal('crypto', { getRandomValues });
		try {
			const fields = FIELD_KINDS.map(({ value }) => configuredField(value));
			const compiled = compileTraceForm({ name: 'HTTP form', fields });
			const reopened = decodeTraceForm('HTTP form', compiled);
			expect(compileTraceForm(reopened)).toEqual(compiled);
			expect(new Set(fields.map((field) => field.key)).size).toBe(fields.length);
			for (const field of fields) expect(field.key).toMatch(/^field_[0-9a-f]{32}$/);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it.each(FIELD_KINDS)('round-trips $value with stable keys and no contract loss', ({ value }) => {
		const draft = { name: 'Вид', fields: [configuredField(value)] };
		const compiled = compileTraceForm(draft);
		const reopened = decodeTraceForm(draft.name, compiled);
		expect(compileTraceForm(reopened)).toEqual(compiled);
		expect(reopened.fields[0].key).toBe(draft.fields[0].key);
	});
	it('preserves values and option keys when labels and order change', () => {
		const weight = configuredField('number');
		if ('unit' in weight) weight.unit = 'кг';
		const choice = configuredField('choice');
		const before = compileTraceForm({ name: 'Замер', fields: [weight, choice] });
		const reopened = decodeTraceForm('Замер', before);
		reopened.fields[0].label = 'Утренний вес';
		const field = reopened.fields[1];
		if ('options' in field) field.options[0].label = 'После прогулки';
		reopened.fields.reverse();
		const after = compileTraceForm(reopened);
		expect(Object.keys(after.dataSchema.properties!)).toEqual([choice.key, weight.key]);
		expect(after.fieldMeta).toEqual(before.fieldMeta);
		expect(() => assertFieldEvolution(before, after)).not.toThrow();
		const option = 'options' in choice ? choice.options[0].key : '';
		expect(() =>
			assertTraceData({ [weight.key!]: 78.4, [choice.key!]: option }, after.dataSchema)
		).not.toThrow();
	});
	it('rejects unsupported authoring and changing a published unit', () => {
		expect(() =>
			decodeTraceForm('Условная форма', {
				dataSchema: { type: 'object', properties: {}, if: { required: ['x'] } }
			})
		).toThrow(expect.objectContaining({ code: 'form_unsupported' }));
		const field = configuredField('number');
		if ('unit' in field) field.unit = 'кг';
		const before = compileTraceForm({ name: 'Вес', fields: [field] });
		const after = structuredClone(before);
		after.fieldMeta[Object.keys(after.fieldMeta)[0]].unit!.id = 'g';
		expect(() => assertFieldEvolution(before, after)).toThrow(
			expect.objectContaining({ code: 'form_unit_changed' })
		);
	});
});
