import { translate } from '$lib/state/Locale/messages';
import type { Locale, MessageKey } from '$lib/state/Locale/types';
import { newTraceField, newVariant } from './TraceForm';
import type {
	TraceFieldDraft,
	TraceFormDraft,
	TraceScalarFieldDraft,
	TraceScalarFieldKind,
	TraceVariantsFieldDraft
} from './types';

/** What «Новый Trace Kind» starts from (owner, 2026-09-29): what to track, not how to build it. */
export const TEMPLATE_IDS = [
	'measure',
	'counter',
	'scale',
	'yesno',
	'note',
	'workout',
	'purchases'
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** How an exercise is counted — Hevy's exercise types that a gym and a morning need. */
export const COUNT_WAYS = [
	'reps',
	'weightReps',
	'bodyweightPlus',
	'assisted',
	'time',
	'weightTime',
	'timeDistance'
] as const;
export type CountWay = (typeof COUNT_WAYS)[number];
/** What a set or an exercise may add on top of its way (owner, 2026-09-29). */
export const EXTRAS = ['rpe', 'rest', 'pulse'] as const;
export type Extra = (typeof EXTRAS)[number];

/** The ways counted in sets; the others are one value, or a few, per exercise. */
const SET_WAYS: readonly CountWay[] = [
	'reps',
	'weightReps',
	'bodyweightPlus',
	'assisted',
	'weightTime'
];
/** An extra a way can take: rest is between sets, so only a way of sets has it. */
export const extrasFor = (way: CountWay): Extra[] =>
	EXTRAS.filter((extra) => extra !== 'rest' || SET_WAYS.includes(way));

/** Ready blocks of fields the «+» offers inside a form. */
export type BlockId = 'reps' | 'weightReps' | 'time' | 'timeDistance';

const scalar = (
	kind: TraceScalarFieldKind,
	label: string,
	extra: Partial<TraceScalarFieldDraft> = {}
): TraceFieldDraft => ({
	...(newTraceField(kind) as TraceScalarFieldDraft),
	label,
	required: false,
	...extra
});

/** The fields of an exercise counted `way`, with its extras: fresh fields, fresh keys. */
export function blockFields(
	way: CountWay,
	language: Locale = 'ru',
	extras: readonly Extra[] = []
): TraceFieldDraft[] {
	const w = (key: MessageKey) => translate(language, key);
	const kg = w('template.kilograms');
	const reps = () => scalar('integer', w('template.reps'), { required: true });
	const perSet: Record<CountWay, () => TraceFieldDraft[]> = {
		reps: () => [reps()],
		weightReps: () => [
			scalar('number', w('template.weight'), { unit: kg, required: true }),
			reps()
		],
		bodyweightPlus: () => [reps(), scalar('number', w('template.extraWeight'), { unit: kg })],
		assisted: () => [reps(), scalar('number', w('template.assist'), { unit: kg, required: true })],
		weightTime: () => [
			scalar('number', w('template.weight'), { unit: kg, required: true }),
			scalar('integer', w('template.time'), { unit: w('template.seconds'), required: true })
		],
		time: () => [],
		timeDistance: () => []
	};
	const rpe = () =>
		scalar('integer', w('template.rpe'), { minimum: 1, maximum: 10, help: w('template.rpeHelp') });
	const own: TraceFieldDraft[] = [];
	if (SET_WAYS.includes(way)) {
		const fields = perSet[way]();
		if (extras.includes('rpe')) fields.push(rpe());
		if (extras.includes('rest'))
			fields.push(scalar('integer', w('template.rest'), { unit: w('template.seconds') }));
		own.push({
			...newTraceField('repeating'),
			kind: 'repeating',
			label: w('template.sets'),
			required: true,
			fields
		});
	} else {
		own.push(scalar('number', w('template.time'), { unit: w('template.minutes'), required: true }));
		if (way === 'timeDistance')
			own.push(scalar('number', w('template.distance'), { unit: w('template.kilometres') }));
		if (extras.includes('rpe')) own.push(rpe());
	}
	if (extras.includes('pulse'))
		own.push(scalar('integer', w('template.pulse'), { unit: w('template.beats') }));
	return own;
}

export type Exercise = Readonly<{
	/** The variant it already is, when the workout is being edited. */
	id?: string;
	label: string;
	way: CountWay;
	extras: readonly Extra[];
}>;

const sameExtras = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((extra) => b.includes(extra));

/**
 * A workout: a list whose every row is one of its exercises, counted its own way. Given the
 * workout it edits, an exercise kept with the same way and extras keeps its fields and their
 * keys — its records stay one history; a changed one gets fresh fields.
 */
export function workoutDraft(
	name: string,
	exercises: readonly Exercise[],
	language: Locale = 'ru',
	editing?: TraceFormDraft
): TraceFormDraft {
	const before = editing?.fields.find(
		(field): field is TraceVariantsFieldDraft => field.kind === 'variants'
	);
	const meta = editing?.template?.exercises ?? {};
	const list: TraceVariantsFieldDraft = before
		? { ...before }
		: {
				...(newTraceField('variants') as TraceVariantsFieldDraft),
				label: translate(language, 'template.exercises'),
				choiceLabel: translate(language, 'template.exercise'),
				required: true
			};
	const template: TraceFormDraft['template'] = { id: 'workout', exercises: {} };
	list.variants = exercises
		.filter((exercise) => exercise.label.trim())
		.map((exercise) => {
			const kept = exercise.id ? before?.variants.find((v) => v.id === exercise.id) : undefined;
			const was = exercise.id ? meta[exercise.id] : undefined;
			const unchanged =
				kept && was && was.way === exercise.way && sameExtras(was.extras, exercise.extras);
			const variant = kept
				? { ...kept, label: exercise.label.trim() }
				: newVariant(exercise.label.trim());
			if (!unchanged) variant.fields = blockFields(exercise.way, language, exercise.extras);
			template.exercises[variant.id] = { way: exercise.way, extras: [...exercise.extras] };
			return variant;
		});
	return {
		...(editing ?? {}),
		name,
		fields: editing ? editing.fields.map((field) => (field === before ? list : field)) : [list],
		template
	};
}

/** The template screen of a workout, read back from the Kind it made; null for any other Kind. */
export function workoutSetupOf(
	draft: TraceFormDraft
): { name: string; exercises: Exercise[] } | null {
	const list = draft.fields.find(
		(field): field is TraceVariantsFieldDraft => field.kind === 'variants'
	);
	if (draft.template?.id !== 'workout' || !list) return null;
	return {
		name: draft.name,
		exercises: list.variants.map((variant) => {
			const meta = draft.template?.exercises[variant.id];
			const way = (COUNT_WAYS as readonly string[]).includes(meta?.way ?? '')
				? (meta!.way as CountWay)
				: 'reps';
			const extras = (meta?.extras ?? []).filter((extra): extra is Extra =>
				(EXTRAS as readonly string[]).includes(extra)
			);
			return { id: variant.id, label: variant.label, way, extras };
		})
	};
}

/** A template's draft: the fields it brings, named in the interface language, ready to adjust. */
export function templateDraft(id: TemplateId, language: Locale = 'ru'): TraceFormDraft {
	const w = (key: MessageKey) => translate(language, key);
	switch (id) {
		case 'measure':
			return { name: '', fields: [scalar('number', w('template.value'), { required: true })] };
		case 'counter':
			return { name: '', fields: [scalar('integer', w('template.count'), { required: true })] };
		case 'scale':
			return {
				name: '',
				fields: [
					scalar('integer', w('template.score'), {
						required: true,
						minimum: 1,
						maximum: 10,
						help: w('template.scoreHelp')
					})
				]
			};
		case 'yesno':
			return { name: '', fields: [scalar('boolean', w('template.done'))] };
		case 'note':
			return { name: '', fields: [scalar('textarea', w('template.text'), { required: true })] };
		case 'workout':
			return workoutDraft(w('template.workoutName'), [], language);
		case 'purchases':
			return {
				name: '',
				fields: [
					{
						...newTraceField('repeating'),
						kind: 'repeating',
						label: w('template.purchases'),
						required: true,
						fields: [
							scalar('text', w('template.item'), { required: true }),
							scalar('number', w('template.price'), { required: true })
						]
					}
				]
			};
	}
}
