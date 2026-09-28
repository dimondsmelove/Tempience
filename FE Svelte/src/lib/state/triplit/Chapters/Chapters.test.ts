import { TriplitClient } from '@triplit/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Chapter } from '$lib/model/Chapters/types';
import { createTriplitRepository } from '../repository';
import type { TempienceRepository } from '../Repository/types';
import { schema } from '../schema';
import { errorText } from '$lib/state/Locale/errors';

const iso = (day: string) => `2026-${day}T00:00:00+02:00`;

describe('the chapters repository', () => {
	let client: TriplitClient<typeof schema>;
	let repository: TempienceRepository;
	beforeEach(() => {
		client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		repository = createTriplitRepository(client);
	});
	afterEach(async () => {
		await client.clear({ full: true });
		client.disconnect();
	});

	const rawChapter = async (id: string) => client.fetchById('chapters', id);
	const rawStage = async (id: string) => client.fetchById('chapterStages', id);

	it('writes chapters and reads them in time, each ending where the next begins', async () => {
		const tempience = await repository.createScope({ name: 'Tempience' });
		const later = await repository.createChapter({
			name: 'Выход наружу',
			start: iso('09-28'),
			lineup: [{ scopeId: tempience.id, level: 'focus' }]
		});
		const earlier = await repository.createChapter({
			name: 'Собрать систему',
			note: 'Довожу Tempience до руки',
			colorHue: 80,
			colorChroma: 90,
			colorDepth: 2,
			start: iso('09-01')
		});
		expect(later).toMatchObject({ end: null, note: '', closedAt: null, stages: [] });
		const chapters = await repository.listChapters();
		expect(chapters.map((chapter) => [chapter.id, chapter.start, chapter.end])).toEqual([
			[earlier.id, iso('09-01'), iso('09-28')],
			[later.id, iso('09-28'), null]
		]);
		expect(chapters[0]).toMatchObject({
			name: 'Собрать систему',
			note: 'Довожу Tempience до руки',
			colorHue: 80,
			colorChroma: 90,
			colorDepth: 2,
			lineup: []
		});
		expect(chapters[1].lineup).toEqual([{ scopeId: tempience.id, level: 'focus' }]);
		// Nothing but the start is stored: no end, no records.
		const stored = await rawChapter(earlier.id);
		expect(stored).not.toHaveProperty('end');
		expect(stored).toMatchObject({ startedAt: iso('09-01'), note: 'Довожу Tempience до руки' });
		expect((await repository.listLogs(earlier.id)).map((log) => log.action)).toEqual(['created']);
	});

	it('refuses a second chapter at the same moment, on create and on a moved start', async () => {
		const first = await repository.createChapter({ name: 'Первая', start: iso('09-01') });
		await repository.createChapter({ name: 'Вторая', start: iso('09-28') });
		await expect(
			repository.createChapter({ name: 'Двойник', start: '2026-08-31T22:00:00Z' })
		).rejects.toThrow('already starts');
		await expect(repository.editChapter(first.id, { start: iso('09-28') })).rejects.toThrow(
			'already starts'
		);
		await expect(
			repository.createChapter({ name: 'Без смещения', start: '2026-09-01T00:00' })
		).rejects.toThrow('ISO instant');
		await expect(repository.createChapter({ name: ' ', start: iso('10-01') })).rejects.toThrow(
			'required'
		);
	});

	it('edits a chapter: a moved start, an explicit close, and nothing written when nothing changed', async () => {
		const chapter = await repository.createChapter({ name: 'Глава', start: iso('09-01') });
		const next = await repository.createChapter({ name: 'Дальше', start: iso('10-01') });
		const closed = await repository.editChapter(chapter.id, {
			closedAt: iso('09-20'),
			note: '  '
		});
		expect(closed).toMatchObject({ end: iso('09-20'), closedAt: iso('09-20'), note: '' });
		const moved = await repository.editChapter(next.id, { start: iso('09-15') });
		expect(moved.end).toBeNull();
		expect((await repository.listChapters())[0].end).toBe(iso('09-15'));
		const logs = (await repository.listLogs(chapter.id)).length;
		await repository.editChapter(chapter.id, { name: 'Глава', closedAt: iso('09-20') });
		expect(await repository.listLogs(chapter.id)).toHaveLength(logs);
	});

	it('keeps stages in time inside their chapter; a stage with no lineup is «как у главы»', async () => {
		const chapter = await repository.createChapter({ name: 'Глава', start: iso('09-01') });
		const push = await repository.createChapterStage(chapter.id, {
			name: 'Рывок',
			start: iso('09-08')
		});
		const open = await repository.createChapterStage(chapter.id, {
			name: 'Открытие',
			note: 'Сначала тело',
			start: iso('09-01'),
			lineup: [{ scopeId: 'body', level: 'focus' }]
		});
		expect(push).toEqual({
			id: push.id,
			name: 'Рывок',
			note: '',
			start: iso('09-08'),
			lineup: null
		});
		const [read] = await repository.listChapters();
		expect(read.stages.map((stage) => [stage.id, stage.lineup])).toEqual([
			[open.id, [{ scopeId: 'body', level: 'focus' }]],
			[push.id, null]
		]);
		const edited = await repository.editChapterStage(open.id, { lineup: null, name: 'Старт' });
		expect(edited).toMatchObject({ name: 'Старт', lineup: null });
		expect(await rawStage(open.id)).toMatchObject({ chapterId: chapter.id, lineup: null });
	});

	it('deletes a chapter with its stages and restores only those that went with it', async () => {
		const chapter = await repository.createChapter({ name: 'Глава', start: iso('09-01') });
		const before = await repository.createChapter({ name: 'Раньше', start: iso('06-01') });
		const kept = await repository.createChapterStage(chapter.id, {
			name: 'А',
			start: iso('09-01')
		});
		const alone = await repository.createChapterStage(chapter.id, {
			name: 'Б',
			start: iso('09-10')
		});
		await repository.setChapterStageDeleted(alone.id, true);

		const deleted = await repository.setChapterDeleted(chapter.id, true);
		expect(deleted.operation).not.toBeNull();
		expect((await repository.listChapters()).map((item) => [item.id, item.end])).toEqual([
			[before.id, null]
		]);
		expect(await rawStage(kept.id)).toMatchObject({
			isDeleted: true,
			deletionOperationId: deleted.operation!.id
		});
		await expect(
			repository.createChapterStage(chapter.id, { name: 'В', start: iso('09-12') })
		).rejects.toThrow('deleted');

		const restored = await repository.setChapterDeleted(chapter.id, false);
		expect(restored.chapter.stages.map((stage) => stage.id)).toEqual([kept.id]);
		expect(await rawStage(alone.id)).toMatchObject({ isDeleted: true });
		expect((await repository.listChapters()).map((item) => item.end)).toEqual([iso('09-01'), null]);
		expect((await repository.setChapterDeleted(chapter.id, false)).operation).toBeNull();
	});

	it('leaves out a deleted Scope on read, keeps it in storage, and brings it back with the Scope', async () => {
		const [a, b, c] = await Promise.all(
			['A', 'B', 'C'].map((name) => repository.createScope({ name }))
		);
		const chapter = await repository.createChapter({
			name: 'Глава',
			start: iso('09-01'),
			lineup: [
				{ scopeId: a.id, level: 'focus' },
				{ scopeId: b.id, level: 'focus' },
				{ scopeId: c.id, level: 'support' }
			]
		});
		const stage = await repository.createChapterStage(chapter.id, {
			name: 'Этап',
			start: iso('09-01'),
			lineup: [
				{ scopeId: b.id, level: 'support' },
				{ scopeId: c.id, level: 'focus' }
			]
		});
		await repository.setScopeDeleted(b.id, true);
		const [read] = await repository.listChapters();
		const ids = (chapter: Chapter) => chapter.lineup.map((entry) => entry.scopeId);
		expect(ids(read)).toEqual([a.id, c.id]);
		expect(read.stages[0].lineup).toEqual([{ scopeId: c.id, level: 'focus' }]);
		expect((await rawChapter(chapter.id))?.lineup).toHaveLength(3);

		// A lineup written over the one read keeps the hidden entry where it stood.
		await repository.editChapter(chapter.id, {
			lineup: [
				{ scopeId: c.id, level: 'focus' },
				{ scopeId: a.id, level: 'support' }
			]
		});
		await repository.editChapterStage(stage.id, { lineup: [{ scopeId: a.id, level: 'focus' }] });
		await repository.setScopeDeleted(b.id, false);
		const [back] = await repository.listChapters();
		// A support entry, stored before «Поддержка» went (owner 2026-09-28), reads in front.
		expect(back.lineup).toEqual([
			{ scopeId: c.id, level: 'focus' },
			{ scopeId: a.id, level: 'focus' },
			{ scopeId: b.id, level: 'focus' }
		]);
		expect(back.stages[0].lineup).toEqual([
			{ scopeId: b.id, level: 'focus' },
			{ scopeId: a.id, level: 'focus' }
		]);
	});

	it('answers a subscription with the chapters as listChapters reads them', async () => {
		const seen: Chapter[][] = [];
		const stop = repository.subscribeChapters(
			(chapters) => seen.push(chapters),
			(error) => {
				throw error;
			}
		);
		try {
			const chapter = await repository.createChapter({ name: 'Глава', start: iso('09-01') });
			await repository.createChapterStage(chapter.id, { name: 'Этап', start: iso('09-02') });
			await expect.poll(() => seen.at(-1)?.[0]?.stages.length).toBe(1);
			expect(seen.at(-1)).toEqual(await repository.listChapters());
		} finally {
			stop();
		}
	});

	it('refuses with codes the forms put into words', async () => {
		const chapter = await repository.createChapter({ name: 'Глава', start: iso('09-01') });
		const stage = await repository.createChapterStage(chapter.id, {
			name: 'Этап',
			start: iso('09-02')
		});
		const refusal = async (write: Promise<unknown>) => {
			try {
				await write;
			} catch (cause: unknown) {
				return {
					code: (cause as { code?: string }).code,
					reason: (cause as { details?: { reason?: string } }).details?.reason,
					text: errorText(cause)
				};
			}
			throw new Error('the write was not refused');
		};
		expect(
			await refusal(repository.createChapter({ name: 'Двойник', start: '2026-08-31T22:00:00Z' }))
		).toEqual({
			code: 'chapter_clash',
			reason: undefined,
			text: 'В этот момент уже начинается другая глава.'
		});
		expect(
			await refusal(
				repository.createChapterStage(chapter.id, { name: 'Рано', start: iso('08-30') })
			)
		).toMatchObject({
			code: 'stage_before_chapter',
			text: 'Этап не может начаться раньше своей главы.'
		});
		expect(
			await refusal(repository.editChapterStage(stage.id, { start: iso('08-30') }))
		).toMatchObject({ code: 'stage_before_chapter' });
		expect(await refusal(repository.editChapter('gone', { name: 'Нет' }))).toMatchObject({
			code: 'chapter_missing',
			text: 'Глава не найдена.'
		});
		expect(await refusal(repository.editChapterStage('gone', { name: 'Нет' }))).toMatchObject({
			code: 'stage_missing'
		});
		expect(
			await refusal(repository.createChapter({ name: 'Глава', start: '2026-10-01T00:00' }))
		).toMatchObject({ code: 'chapter_invalid', reason: 'instant' });
		expect(
			await refusal(
				repository.createChapter({
					name: 'Глава',
					start: iso('10-01'),
					lineup: [
						{ scopeId: 'a', level: 'focus' },
						{ scopeId: 'a', level: 'support' }
					]
				})
			)
		).toMatchObject({
			code: 'chapter_invalid',
			reason: 'lineup',
			text: 'Состав задан неверно: каждый Scope — один раз, в фокусе или в поддержке.'
		});
		expect(
			await refusal(repository.createChapter({ name: '', start: iso('10-01') }))
		).toMatchObject({ code: 'chapter_invalid', reason: 'name', text: 'Нужно название.' });
		await repository.setChapterDeleted(chapter.id, true);
		expect(
			await refusal(
				repository.createChapterStage(chapter.id, { name: 'Этап', start: iso('09-03') })
			)
		).toMatchObject({
			code: 'chapter_missing',
			reason: 'deleted',
			text: 'Глава удалена: изменить её уже нельзя.'
		});
		expect(await refusal(repository.editChapterStage(stage.id, { name: 'Этап' }))).toMatchObject({
			code: 'stage_missing',
			reason: 'deleted'
		});
	});

	describe('a moved chapter start and its stages', () => {
		const setup = async () => {
			const chapter = await repository.createChapter({ name: 'Глава', start: iso('09-01') });
			const first = await repository.createChapterStage(chapter.id, {
				name: 'Открытие',
				start: iso('09-01')
			});
			const second = await repository.createChapterStage(chapter.id, {
				name: 'Рывок',
				start: iso('09-10')
			});
			return { chapter, first, second };
		};
		const starts = async () =>
			(await repository.listChapters())[0].stages.map((stage) => [stage.name, stage.start]);

		it('earlier: the stage that started with the chapter follows, in the same operation', async () => {
			const { chapter, first } = await setup();
			const moved = await repository.editChapter(chapter.id, { start: iso('08-25') });
			expect(moved.start).toBe(iso('08-25'));
			expect(await starts()).toEqual([
				['Открытие', iso('08-25')],
				['Рывок', iso('09-10')]
			]);
			const [chapterLog] = await repository.listLogs(chapter.id);
			const [stageLog] = await repository.listLogs(first.id);
			expect(stageLog).toMatchObject({ action: 'updated', entityType: 'chapterStage' });
			expect(stageLog.patch).toEqual({ startedAt: { before: iso('09-01'), after: iso('08-25') } });
			expect(stageLog.operationId).toBe(chapterLog.operationId);
		});

		it('later but before the second stage: the first stage follows', async () => {
			const { chapter } = await setup();
			await repository.editChapter(chapter.id, { start: iso('09-05') });
			expect(await starts()).toEqual([
				['Открытие', iso('09-05')],
				['Рывок', iso('09-10')]
			]);
		});

		it('later than the second stage: refused, nothing written, the stage named', async () => {
			const { chapter, second } = await setup();
			const logs = (await repository.listLogs()).length;
			const refusal = await repository
				.editChapter(chapter.id, { start: iso('09-12'), name: 'Другая' })
				.then(
					() => null,
					(cause: unknown) => cause
				);
			expect(refusal).toMatchObject({
				code: 'chapter_invalid',
				details: { reason: 'stages', name: 'Рывок', stageId: second.id }
			});
			expect(errorText(refusal)).toBe(
				'Этап «Рывок» начинается раньше нового начала главы: сначала передвиньте или удалите его.'
			);
			expect((await repository.listChapters())[0]).toMatchObject({
				name: 'Глава',
				start: iso('09-01')
			});
			expect(await starts()).toEqual([
				['Открытие', iso('09-01')],
				['Рывок', iso('09-10')]
			]);
			expect(await repository.listLogs()).toHaveLength(logs);
		});
	});

	it('takes an explicit end after the start and not past the next chapter', async () => {
		const first = await repository.createChapter({ name: 'Первая', start: iso('09-01') });
		await repository.createChapter({ name: 'Вторая', start: iso('09-28') });
		const reason = (write: Promise<unknown>) =>
			write.then(
				() => null,
				(cause: { details?: Record<string, unknown> }) => cause.details
			);
		expect(
			await reason(
				repository.createChapter({ name: 'Ноль', start: iso('10-10'), closedAt: iso('10-10') })
			)
		).toMatchObject({ reason: 'close' });
		expect(
			await reason(repository.editChapter(first.id, { closedAt: iso('09-30') }))
		).toMatchObject({ reason: 'closeAfterNext', name: 'Вторая' });
		expect(
			await reason(
				repository.createChapter({
					name: 'Давняя',
					start: '2019-10-10T00:00:00+02:00',
					closedAt: iso('09-02')
				})
			)
		).toMatchObject({ reason: 'closeAfterNext', name: 'Первая' });
		// Up to the next start, or earlier, is a close; the derived end follows it.
		expect((await repository.editChapter(first.id, { closedAt: iso('09-28') })).end).toBe(
			iso('09-28')
		);
		expect((await repository.editChapter(first.id, { closedAt: iso('09-20') })).end).toBe(
			iso('09-20')
		);
		// A chapter inserted inside a closed one later: the close stays, the end follows the newcomer.
		await repository.createChapter({ name: 'Внутри', start: iso('09-10') });
		const renamed = await repository.editChapter(first.id, { name: 'Первая глава' });
		expect(renamed).toMatchObject({ closedAt: iso('09-20'), end: iso('09-10') });
	});

	it('creates chapters at past dates: before the first, between two, inside one', async () => {
		const past = (date: string) => `${date}T00:00:00+02:00`;
		await repository.createChapter({
			name: 'Работа',
			start: past('2021-01-01'),
			closedAt: past('2021-06-01')
		});
		await repository.createChapter({ name: 'Переезд', start: past('2022-03-01') });
		await repository.createChapter({ name: 'Учёба', start: past('2019-10-10') });
		await repository.createChapter({ name: 'Пауза', start: past('2021-09-01') });
		await repository.createChapter({ name: 'Отпуск', start: past('2022-07-01') });
		expect((await repository.listChapters()).map((chapter) => [chapter.name, chapter.end])).toEqual(
			[
				['Учёба', past('2021-01-01')],
				['Работа', past('2021-06-01')],
				['Пауза', past('2022-03-01')],
				['Переезд', past('2022-07-01')],
				['Отпуск', null]
			]
		);
	});

	it('refuses an AI actor writing a chapter directly', async () => {
		expect(() => repository.createChapter({ name: 'Глава', start: iso('09-01') }, 'ai')).toThrow(
			'AI'
		);
		expect(await repository.listChapters()).toEqual([]);
	});
});
