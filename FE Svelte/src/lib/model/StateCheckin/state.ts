import { TH, WORDS } from './constants';
import type { MoodBand, Quadrant, Scale } from './types';

// Thresholds, dictionary order and ranking come from the owner's checkin-logic.ts.
export const quadrant = (energy: number, tension: number): Quadrant =>
	((tension >= TH.tension_high_ge ? 'Напряжённая ' : 'Спокойная ') +
		(energy >= TH.energy_high_ge ? 'энергия' : 'усталость')) as Quadrant;

export const moodBand = (mood: number): MoodBand =>
	mood >= TH.mood_pleasant_ge
		? 'приятно'
		: mood <= TH.mood_unpleasant_le
			? 'неприятно'
			: 'нейтрально';

/** До 10 подсказанных слов для текущего состояния. */
export function candidates(energy: number, tension: number, mood: number, limit = 10): string[] {
	const q = quadrant(energy, tension),
		b = moodBand(mood);
	return WORDS.map(([w, wq, wb], i) => ({
		w,
		wq,
		i,
		r: wb === b ? 0 : wb === 'нейтрально' ? 1 : 2
	}))
		.filter((x) => x.wq === q)
		.sort((a, c) => a.r - c.r || a.i - c.i)
		.slice(0, limit)
		.map((x) => x.w);
}

export const isScale = (value: unknown): value is Scale =>
	typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
