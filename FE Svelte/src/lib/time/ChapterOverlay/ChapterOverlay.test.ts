import { describe, expect, it } from 'vitest';
import { chapter, chapters, now } from '$lib/model/Chapters/Chapters.fixture';
import { resolveEnds } from '$lib/model/Chapters';
import { ms } from '$lib/model/Chapters';
import { chapterLines } from './lines';

const window = { start: ms('2026-08-01T00:00:00+02:00'), end: ms('2026-10-31T00:00:00+02:00') };

describe('the chapters over the lanes', () => {
	it('draws a line where each chapter starts, and an end only before a gap or at an early close', () => {
		const lines = chapterLines(chapters, window, 920, now);
		expect(lines.map((line) => [line.key, line.future])).toEqual([
			['system:start', false],
			['out:start', true]
		]);
		const closed = resolveEnds([
			chapter('a', '2026-09-01T00:00:00+02:00', null, { closedAt: '2026-09-20T00:00:00+02:00' }),
			chapter('b', '2026-10-01T00:00:00+02:00', null)
		]);
		expect(chapterLines(closed, window, 920, now).map((line) => line.key)).toEqual([
			'a:start',
			'a:end',
			'b:start'
		]);
		expect(chapterLines(chapters, window, 0, now)).toEqual([]);
	});
});
