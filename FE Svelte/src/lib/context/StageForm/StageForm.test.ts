import { describe, expect, it } from 'vitest';
import { system } from '$lib/model/Chapters/Chapters.fixture';
import { ms } from '$lib/model/Chapters';
import { stageProblem } from './validation';

const at = (day: string) => ms(`2026-09-${day}T00:00:00+02:00`);

describe('a stage’s form', () => {
	it('needs a name and a readable start inside the chapter', () => {
		expect(stageProblem(system, null, ' ', at('10'))).toBe('chapter.stageNameRequired');
		expect(stageProblem(system, null, 'Этап', null)).toBe('chapter.startUnreadable');
		expect(stageProblem(system, null, 'Этап', at('28'))).toBe('chapter.stageInside');
		expect(stageProblem(system, null, 'Этап', at('10'))).toBeNull();
	});
	it('keeps an edited stage between its neighbours, and two stages apart', () => {
		expect(stageProblem(system, 'push', 'Рывок', at('01'))).toBe('chapter.stageAfterPrevious');
		expect(stageProblem(system, 'open', 'Открытие', at('08'))).toBe('chapter.stageBeforeNext');
		expect(stageProblem(system, null, 'Этап', at('08'))).toBe('chapter.stageClash');
		expect(stageProblem(system, 'push', 'Рывок', at('12'))).toBeNull();
	});
});
