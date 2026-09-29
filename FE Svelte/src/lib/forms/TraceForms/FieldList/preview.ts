import type { TraceFieldDraft, TraceFormDraft } from '$lib/model/TraceForm/types';

export type PreviewWords = Readonly<{
	kind: string;
	field: (n: number) => string;
	option: (n: number) => string;
}>;

/**
 * The draft as the live preview compiles it: what is still unnamed gets a stand-in name and a
 * list without fields yet is left out, so the preview keeps standing while a field is being
 * added. The draft itself is not touched; only the save compiles it as it is.
 */
export function previewDraft(draft: TraceFormDraft, words: PreviewWords): TraceFormDraft {
	const fields = (level: readonly TraceFieldDraft[]): TraceFieldDraft[] =>
		level.flatMap((field, index): TraceFieldDraft[] => {
			const label = field.label.trim() || words.field(index + 1);
			if (field.kind === 'variants') {
				const variants = field.variants.map((variant, n) => ({
					...variant,
					label: variant.label.trim() || words.option(n + 1),
					fields: fields(variant.fields)
				}));
				return variants.length ? [{ ...field, label, variants }] : [];
			}
			if (field.kind === 'repeating' || field.kind === 'group') {
				const inner = fields(field.fields);
				return inner.length ? [{ ...field, label, fields: inner }] : [];
			}
			return [
				{
					...field,
					label,
					options: field.options.map((option, n) => ({
						...option,
						label: option.label.trim() || words.option(n + 1)
					}))
				}
			];
		});
	return { ...draft, name: draft.name.trim() || words.kind, fields: fields(draft.fields) };
}
