import type {
	TraceFieldDraft,
	TraceRepeatingFieldDraft,
	TraceScalarFieldDraft,
	TraceVariantsFieldDraft
} from './types';

/** A list of variants as the compiler knows it: a list whose first field chooses the variant. */
export function variantsAsList(field: TraceVariantsFieldDraft): TraceRepeatingFieldDraft {
	const choice: TraceScalarFieldDraft = {
		id: field.choiceId,
		key: field.choiceKey,
		label: field.choiceLabel.trim() || field.label,
		kind: 'choice',
		required: true,
		unit: '',
		original: field.choiceOriginal,
		locked: field.locked,
		options: field.variants.map((variant) => ({
			id: variant.id,
			key: variant.key,
			label: variant.label,
			shows: variant.fields.map((own) => own.id)
		}))
	};
	return {
		id: field.id,
		key: field.key,
		label: field.label,
		required: field.required,
		help: field.help,
		original: field.original,
		locked: field.locked,
		kind: 'repeating',
		minItems: field.minItems,
		maxItems: field.maxItems,
		fields: [choice, ...field.variants.flatMap((variant) => variant.fields)]
	};
}

/**
 * A list read back as variants when it is one: its first field is a choice and every other
 * field is shown by exactly one of its options, nothing else deciding. Otherwise null — the
 * list stays a list, its conditions as they are.
 */
export function listAsVariants(field: TraceRepeatingFieldDraft): TraceVariantsFieldDraft | null {
	const [choice, ...rest] = field.fields;
	if (!choice || choice.kind !== 'choice' || !rest.length) return null;
	const owner = new Map<string, string>();
	for (const option of choice.options)
		for (const id of option.shows ?? []) {
			if (owner.has(id)) return null;
			owner.set(id, option.id);
		}
	if (!rest.every((own) => owner.has(own.id))) return null;
	if (rest.some((own) => own.kind === 'choice' && own.options.some((o) => o.shows?.length)))
		return null;
	return {
		id: field.id,
		key: field.key,
		label: field.label,
		required: field.required,
		help: field.help,
		original: field.original,
		locked: field.locked,
		kind: 'variants',
		minItems: field.minItems,
		maxItems: field.maxItems,
		choiceLabel: choice.label,
		choiceId: choice.id,
		choiceKey: choice.key,
		choiceOriginal: choice.original,
		variants: choice.options.map((option) => ({
			id: option.id,
			key: option.key,
			label: option.label,
			fields: rest.filter((own) => owner.get(own.id) === option.id)
		}))
	};
}

/** Every list of variants, at any depth, as the plain list the compiler reads. */
export const expandVariants = (fields: readonly TraceFieldDraft[]): TraceFieldDraft[] =>
	fields.map((field): TraceFieldDraft => {
		if (field.kind === 'variants') {
			const list = variantsAsList(field);
			return { ...list, fields: expandVariants(list.fields) };
		}
		return 'fields' in field ? { ...field, fields: expandVariants(field.fields) } : field;
	});

/** Every list that reads as variants, at any depth, shown as variants again. */
export const collapseVariants = (fields: readonly TraceFieldDraft[]): TraceFieldDraft[] =>
	fields.map((field): TraceFieldDraft => {
		if (field.kind === 'repeating') {
			const variants = listAsVariants(field);
			if (variants)
				return {
					...variants,
					variants: variants.variants.map((variant) => ({
						...variant,
						fields: collapseVariants(variant.fields)
					}))
				};
		}
		return 'fields' in field ? { ...field, fields: collapseVariants(field.fields) } : field;
	});
