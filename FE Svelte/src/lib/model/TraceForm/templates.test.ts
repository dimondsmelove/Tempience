import { describe, expect, it } from 'vitest';
import { assertTraceData } from '$lib/state/triplit/trace-kind-v-validation';
import type { JsonObject } from '$lib/state/triplit/types';
import { traceFormDisplay } from './display';
import { compileTraceForm } from './schema';
import { decodeTraceForm } from './TraceForm';
import { TEMPLATE_IDS, templateDraft, workoutDraft, workoutSetupOf } from './templates';
import type { TraceVariantsFieldDraft } from './types';

describe('templates: what to track, not how to build it', () => {
	it('gives every template a form that compiles once it is named', () => {
		for (const id of TEMPLATE_IDS) {
			const draft = templateDraft(id);
			if (id === 'workout') continue; // a workout needs its exercises first
			expect(() => compileTraceForm({ ...draft, name: draft.name || id }), id).not.toThrow();
		}
	});

	it('makes a workout from exercises and how each is counted, and records a morning', () => {
		const definition = compileTraceForm(
			workoutDraft('Утренняя физуха', [
				{ label: 'Отжимания', way: 'reps', extras: [] },
				{ label: 'Становая тяга', way: 'weightReps', extras: [] },
				{ label: 'Бег', way: 'timeDistance', extras: [] },
				{ label: 'Планка', way: 'time', extras: [] },
				{ label: '  ', way: 'reps', extras: [] }
			])
		);
		const draft = decodeTraceForm('Утренняя физуха', definition);
		expect(draft.fields[0].kind).toBe('variants');
		// The keys of a generated form are its own: everything is found by its title.
		const byTitle = (properties: JsonObject, title: string, after = 0) =>
			Object.keys(properties).filter((key) => (properties[key] as JsonObject).title === title)[
				after
			];
		const top = definition.dataSchema.properties as JsonObject;
		const listKey = byTitle(top, 'Упражнения');
		const row = ((top[listKey] as JsonObject).items as JsonObject).properties as JsonObject;
		const choiceKey = byTitle(row, 'Упражнение');
		const options = (row[choiceKey] as JsonObject).oneOf as JsonObject[];
		expect(options.map((option) => option.title)).toEqual([
			'Отжимания',
			'Становая тяга',
			'Бег',
			'Планка'
		]);
		const value = (title: string) =>
			String(options.find((option) => option.title === title)?.const);
		const inner = (key: string) =>
			((row[key] as JsonObject).items as JsonObject).properties as JsonObject;
		const pushSets = byTitle(row, 'Подходы', 0);
		const liftSets = byTitle(row, 'Подходы', 1);
		const pushReps = byTitle(inner(pushSets), 'Повторы');
		const liftWeight = byTitle(inner(liftSets), 'Вес');
		const liftReps = byTitle(inner(liftSets), 'Повторы');
		const data = {
			[listKey]: [
				{ [choiceKey]: value('Отжимания'), [pushSets]: [{ [pushReps]: 15 }, { [pushReps]: 12 }] },
				{ [choiceKey]: value('Становая тяга'), [liftSets]: [{ [liftWeight]: 100, [liftReps]: 5 }] },
				{
					[choiceKey]: value('Бег'),
					[byTitle(row, 'Время', 0)]: 18,
					[byTitle(row, 'Дистанция')]: 3
				}
			]
		};
		expect(() => assertTraceData(data, definition.dataSchema)).not.toThrow();
		expect(traceFormDisplay(definition, data).conciseFields[0]?.value).toBe(
			'Отжимания 15+12 · Становая тяга 100 кг×5 · Бег 18 мин, 3 км'
		);
	});

	it('opens a saved workout as its template, and keeps an unchanged exercise as one history', () => {
		const made = workoutDraft('Физуха', [
			{ label: 'Отжимания', way: 'reps', extras: [] },
			{ label: 'Жим', way: 'weightReps', extras: ['rpe'] }
		]);
		const saved = decodeTraceForm('Физуха', compileTraceForm(made));
		const setup = workoutSetupOf(saved)!;
		expect(setup.exercises.map(({ label, way, extras }) => [label, way, extras])).toEqual([
			['Отжимания', 'reps', []],
			['Жим', 'weightReps', ['rpe']]
		]);
		const listOf = (draft: typeof saved) =>
			draft.fields.find((field) => field.kind === 'variants') as TraceVariantsFieldDraft;
		const keysOf = (draft: typeof saved, n: number) =>
			JSON.stringify(listOf(draft).variants[n].fields.map((field) => field.key));
		// Push-ups renamed, the press now also takes rest, a run added.
		const edited = workoutDraft(
			'Физуха',
			[
				{ ...setup.exercises[0], label: 'Отжимания на кулаках' },
				{ ...setup.exercises[1], extras: ['rpe', 'rest'] },
				{ label: 'Бег', way: 'timeDistance', extras: ['pulse'] }
			],
			'ru',
			saved
		);
		expect(listOf(edited).variants.map((v) => v.label)).toEqual([
			'Отжимания на кулаках',
			'Жим',
			'Бег'
		]);
		expect(keysOf(edited, 0)).toBe(keysOf(saved, 0));
		expect(keysOf(edited, 1)).not.toBe(keysOf(saved, 1));
		expect(listOf(edited).variants[0].id).toBe(listOf(saved).variants[0].id);
		expect(() => compileTraceForm(edited)).not.toThrow();
	});
});
