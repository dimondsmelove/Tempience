import { describe, expect, it } from 'vitest';
import {
	currentChapter,
	freeMidnight,
	nextBoundary,
	planInsert,
	resolveEnds,
	statusAt
} from './Chapters';
import { chapter, chapters, move, now, out, story3, ZONE } from './Chapters.fixture';
import { ms, msToIso } from './time';
import type { Chapter } from './types';

describe('chapters in time', () => {
	it('finds the current chapter and each status', () => {
		expect(currentChapter(chapters, now)?.id).toBe('system');
		expect(statusAt(move, now)).toBe('past');
		expect(statusAt(out, now)).toBe('future');
		expect(currentChapter(chapters, ms(out.start))?.id).toBe('out');
	});
	it('a new chapter inside the current one ends it and stops at the next', () => {
		const start = '2026-09-20T00:00:00+02:00';
		const plan = planInsert(chapters, ms(start));
		expect(plan.ends?.id).toBe('system');
		expect(plan.until?.id).toBe('out');
		expect(plan.clash).toBeNull();
		const next = resolveEnds([...chapters, chapter('pause', start, null)]);
		expect(next.map((item) => item.id)).toEqual(['move', 'system', 'pause', 'out']);
		expect(next.find((item) => item.id === 'system')?.end).toBe(start);
		expect(next.find((item) => item.id === 'pause')?.end).toBe(out.start);
	});
	it('refuses a second chapter at the same moment', () => {
		expect(planInsert(chapters, ms(out.start)).clash?.id).toBe('out');
	});
	it('a moved start drags the chapter that ended there', () => {
		const moved = { ...out, start: '2026-10-05T00:00:00+02:00' };
		const next = resolveEnds(chapters.map((item) => (item.id === out.id ? moved : item)));
		expect(next.find((item) => item.id === 'system')?.end).toBe(moved.start);
		expect(next.find((item) => item.id === 'out')?.start).toBe(moved.start);
	});
	it('finds the next boundary «сейчас» will cross: a start, an end or a stage', () => {
		expect(nextBoundary(chapters, now)).toBe(ms(out.start));
		expect(nextBoundary(chapters, ms('2026-09-03T00:00:00+02:00'))).toBe(
			ms('2026-09-08T00:00:00+02:00')
		);
		expect(nextBoundary(chapters, ms(out.start))).toBeNull();
		expect(nextBoundary([], now)).toBeNull();
	});
	it('starts a new chapter at the next free midnight', () => {
		const at = ms('2026-09-27T12:00:00+02:00');
		expect(msToIso(freeMidnight(story3, at, ZONE), ZONE)).toBe('2026-09-29T00:00:00+02:00');
		expect(msToIso(freeMidnight([], at, ZONE), ZONE)).toBe('2026-09-28T00:00:00+02:00');
	});
});

describe('round 4: derived ends', () => {
	const iso = (day: string) => `2026-${day}T00:00:00+02:00`;
	const bare = (id: string, start: string, closedAt: string | null = null) =>
		({ ...chapter(id, start, null), closedAt }) satisfies Chapter;
	const story = resolveEnds([
		bare('move', iso('06-01')),
		bare('system', iso('09-01')),
		bare('out', iso('09-28'))
	]);
	const endOfId = (list: readonly Chapter[], id: string) =>
		list.find((item) => item.id === id)?.end;
	const insert = (list: readonly Chapter[], item: Chapter) => resolveEnds([...list, item]);
	const remove = (list: readonly Chapter[], id: string) =>
		resolveEnds(list.filter((item) => item.id !== id));
	const close = (list: readonly Chapter[], id: string, at: string) =>
		resolveEnds(list.map((item) => (item.id === id ? { ...item, closedAt: at } : item)));

	it('derives each end from the next start; the last one runs on', () => {
		expect(story.map((item) => item.end)).toEqual([iso('09-01'), iso('09-28'), null]);
	});
	it('a chapter created inside another ends it there by derivation, nothing written on it', () => {
		const next = insert(story, bare('pause', iso('10-28')));
		expect(endOfId(next, 'out')).toBe(iso('10-28'));
		expect(next.find((item) => item.id === 'out')?.closedAt).toBeNull();
		expect(endOfId(next, 'pause')).toBeNull();
	});
	it('the owner’s path: create after «Выход наружу», delete it — «Выход наружу» runs on again', () => {
		const created = insert(story, bare('pause', iso('10-28')));
		const deleted = remove(created, 'pause');
		expect(endOfId(deleted, 'out')).toBeNull();
		expect(deleted).toHaveLength(3);
	});
	it('deleting a middle chapter lets the one before it run on to the next', () => {
		expect(endOfId(remove(story, 'system'), 'move')).toBe(iso('09-28'));
	});
	it('an explicit close ends a chapter early and may leave a gap; it survives neighbours changing', () => {
		const closed = close(story, 'out', iso('10-10'));
		expect(endOfId(closed, 'out')).toBe(iso('10-10'));
		const later = insert(closed, bare('after', iso('11-01')));
		expect(endOfId(later, 'out')).toBe(iso('10-10'));
		const earlier = insert(closed, bare('inside', iso('10-05')));
		expect(endOfId(earlier, 'out')).toBe(iso('10-05'));
	});
});
