import { describe, expect, it } from 'vitest';
import { chapters, now, out, system } from '$lib/model/Chapters/Chapters.fixture';
import { ms, planInsert } from '$lib/model/Chapters';
import { chapterProblem } from './validation';

describe('a chapter’s form', () => {
	const at = ms('2026-09-20T00:00:00+02:00');
	it('needs a name, a readable start and a moment no other chapter starts at', () => {
		expect(chapterProblem(' ', at, planInsert(chapters, at), null, true)).toEqual({
			key: 'chapter.nameRequired'
		});
		expect(chapterProblem('Пауза', null, null, null, true)).toEqual({
			key: 'chapter.startUnreadable'
		});
		const clash = ms(out.start);
		expect(chapterProblem('Пауза', clash, planInsert(chapters, clash), null, true)).toEqual({
			key: 'chapter.clash',
			name: 'out'
		});
	});
	it('asks to confirm the end of the chapter it starts inside, and keeps an edit before its end', () => {
		expect(chapterProblem('Пауза', at, planInsert(chapters, at), null, false)).toEqual({
			key: 'chapter.confirmEnd'
		});
		expect(chapterProblem('Пауза', at, planInsert(chapters, at), null, true)).toBeNull();
		expect(chapterProblem('Глава', now, null, now, true)).toEqual({
			key: 'chapter.startBeforeEnd'
		});
	});
	it('keeps an edited start before its stages: the one that started with it moves along', () => {
		const day = (date: string) => ms(`2026-${date}T00:00:00+02:00`);
		const others = chapters.filter((item) => item.id !== system.id);
		const check = (start: number) =>
			chapterProblem('Собрать', start, planInsert(others, start), ms(system.end!), true, system);
		// Earlier, or later but before «Рывок» (8 Sep): «Открытие» follows the start.
		expect(check(day('08-25'))).toBeNull();
		expect(check(day('09-05'))).toBeNull();
		// Later than «Рывок»: the form names it before anything is saved.
		expect(check(day('09-12'))).toEqual({ key: 'error.chapter_invalid_stages', name: 'Рывок' });
		// A new chapter has no stages to leave behind.
		expect(chapterProblem('Новая', day('10-05'), null, null, true, null)).toBeNull();
	});
	it('takes an end after the start and not after the next chapter’s start', () => {
		const at = ms('2026-09-20T00:00:00+02:00');
		const plan = planInsert(chapters, at);
		const problem = (end: number | null) =>
			chapterProblem('Пауза', at, plan, null, true, null, end);
		expect(problem(null)).toBeNull();
		expect(problem(ms('2026-09-25T00:00:00+02:00'))).toBeNull();
		expect(problem(ms(out.start))).toBeNull();
		expect(problem(at)).toEqual({ key: 'error.chapter_invalid_close' });
		expect(problem(ms('2026-09-30T00:00:00+02:00'))).toEqual({
			key: 'error.chapter_invalid_closeAfterNext',
			name: 'out'
		});
	});
	it('creates a chapter at any past date: before the first, between two, inside one', () => {
		const past = (date: string) => ms(`${date}T00:00:00+02:00`);
		const check = (start: number, confirmEnd = true) =>
			chapterProblem('Давняя', start, planInsert(chapters, start), null, confirmEnd);
		// Before the first chapter: it runs to the first one's start.
		expect(planInsert(chapters, past('2019-10-10'))).toMatchObject({ ends: null, clash: null });
		expect(planInsert(chapters, past('2019-10-10')).until?.id).toBe('move');
		expect(check(past('2019-10-10'))).toBeNull();
		// Inside a past chapter: that one ends there once confirmed.
		const inside = past('2026-07-15');
		expect(planInsert(chapters, inside).ends?.id).toBe('move');
		expect(check(inside, false)).toEqual({ key: 'chapter.confirmEnd' });
		expect(check(inside)).toBeNull();
		// Between two past chapters (a gap after an early close): no one ends, the next bounds it.
		const closed = chapters.map((item) =>
			item.id === 'move'
				? { ...item, closedAt: '2026-08-01T00:00:00+02:00', end: '2026-08-01T00:00:00+02:00' }
				: item
		);
		const between = past('2026-08-10');
		expect(planInsert(closed, between)).toMatchObject({ ends: null, clash: null });
		expect(planInsert(closed, between).until?.id).toBe('system');
		expect(chapterProblem('Между', between, planInsert(closed, between), null, true)).toBeNull();
	});
});
