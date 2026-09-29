import type {
	TraceChoiceDraft,
	TraceFieldDraft,
	TraceScalarFieldDraft
} from '$lib/model/TraceForm/types';

/** When a field is shown: the choice beside it that decides, and its options that show it. */
export type Visibility = Readonly<{ controllerId: string; optionIds: readonly string[] }>;

type Choice = TraceScalarFieldDraft & { kind: 'choice' };
const isChoice = (field: TraceFieldDraft): field is Choice => field.kind === 'choice';

/** The choice fields beside `field` that may decide whether it is shown. */
export const controllersFor = (
	fields: readonly TraceFieldDraft[],
	field: TraceFieldDraft
): Choice[] => fields.filter((other): other is Choice => isChoice(other) && other.id !== field.id);

/**
 * When `field` is shown, read from the options beside it (the model the compiler reads, loop
 * 013): the first choice with an option that shows it decides; none — it is always shown.
 */
export function visibilityOf(
	fields: readonly TraceFieldDraft[],
	field: TraceFieldDraft
): Visibility | null {
	for (const choice of controllersFor(fields, field)) {
		const optionIds = choice.options
			.filter((option) => option.shows?.includes(field.id))
			.map((option) => option.id);
		if (optionIds.length) return { controllerId: choice.id, optionIds };
	}
	return null;
}

/**
 * Shows `fieldId` only for the given options of one choice, or always (null): the options of
 * every other choice stop naming it, so one choice decides a field at most.
 */
export function setVisibility(
	fields: readonly TraceFieldDraft[],
	fieldId: string,
	next: Visibility | null
): void {
	for (const choice of fields.filter(isChoice))
		for (const option of choice.options) {
			const kept = (option.shows ?? []).filter((id) => id !== fieldId);
			const on =
				next !== null && choice.id === next.controllerId && next.optionIds.includes(option.id);
			option.shows = on ? [...kept, fieldId] : kept;
		}
	if (next) {
		const controller = fields.find((field) => field.id === next.controllerId);
		// The compiler makes a deciding choice required; the draft says so too.
		if (controller) controller.required = true;
	}
}

/** The fields beside it that an option shows, by their current names. */
export const shownBy = (
	fields: readonly TraceFieldDraft[],
	option: TraceChoiceDraft
): TraceFieldDraft[] => fields.filter((field) => option.shows?.includes(field.id));
