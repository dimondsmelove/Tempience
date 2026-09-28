import { TriplitClient } from '@triplit/client';
import { describe, expect, it } from 'vitest';
import { currentChapter, ms } from '$lib/model/Chapters';
import { lineup, now, tree } from '$lib/model/Chapters/Chapters.fixture';
import { createTriplitRepository } from '$lib/state/triplit/repository';
import { schema } from '$lib/state/triplit/schema';
import { seedChapterStory, seedChapters } from './story.fixture';

describe('the chapters story fixture', () => {
	it('seeds the story with contexts found by name', () => {
		const story = seedChapters(tree.scopes.map((item) => ({ id: item.id, name: item.name })));
		expect(story.map((item) => item.name)).toEqual(['Переезд', 'Собрать систему', 'Выход наружу']);
		expect(currentChapter(story, now)?.name).toBe('Собрать систему');
	});

	it('seeds levels, the Открытие lineup and hues apart from the Scopes', () => {
		const named = [
			['Белград', 45],
			['Сербский', 170],
			['Работа', 30],
			['Tempience', 195],
			['Зажимы', 350],
			['Питание', 120],
			['Люди', 285],
			['Бокс', 5]
		].map(([name, colorHue]) => ({
			id: String(name),
			name: String(name),
			colorHue: Number(colorHue)
		}));
		const [move, build, out] = seedChapters(named);
		expect(move.lineup).toEqual(lineup(['Белград', 'Сербский'], ['Работа']));
		expect(build.lineup).toEqual(lineup(['Tempience'], ['Зажимы', 'Питание', 'Люди']));
		expect(build.stages[0].lineup).toEqual(lineup(['Питание', 'Зажимы'], ['Tempience']));
		expect(build.stages[1].lineup).toBeNull();
		expect(out.lineup).toEqual(lineup(['Tempience', 'Бокс'], ['Люди']));
		for (const item of [move, build, out])
			for (const scope of named)
				expect(
					Math.min(
						Math.abs(item.colorHue! - scope.colorHue),
						360 - Math.abs(item.colorHue! - scope.colorHue)
					)
				).toBeGreaterThanOrEqual(25);
	});

	it('writes the whole story into a space, chapters and stages through the repository', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			const repository = createTriplitRepository(client);
			const chapters = await seedChapterStory(repository);
			expect(chapters.map((item) => [item.name, item.stages.length, item.end])).toEqual([
				['Переезд', 2, '2026-09-01T00:00:00+02:00'],
				['Собрать систему', 2, '2026-09-28T00:00:00+02:00'],
				['Выход наружу', 0, null]
			]);
			expect(chapters[1].note).toContain('Tempience');
			expect(chapters[1].lineup).toHaveLength(4);
			expect(ms(chapters[1].stages[1].start)).toBe(ms('2026-09-08T00:00:00+02:00'));
			expect((await repository.listScopes()).length).toBe(12);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
});
