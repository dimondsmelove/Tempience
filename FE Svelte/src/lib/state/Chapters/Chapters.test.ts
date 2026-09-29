import { describe, expect, it, vi } from 'vitest';
import { chapters, now, system, tree } from '$lib/model/Chapters/Chapters.fixture';
import type { Chapter } from '$lib/model/Chapters/types';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { SelectionState } from '$lib/state/Selection/Selection.svelte';
import { ChaptersState } from './Chapters.svelte';
import type { ChapterWriter } from './types';

const storeOf = (list: readonly Chapter[]) => {
	const selection = new SelectionState();
	const store = new ChaptersState(() => ({ ...tree, chapters: list }), selection);
	store.now = now;
	return { store, selection };
};

const writerOf = (overrides: Partial<ChapterWriter> = {}): ChapterWriter => ({
	createChapter: vi.fn(async (draft) => ({
		...system,
		id: 'new',
		...draft,
		end: null,
		closedAt: null,
		stages: []
	})),
	editChapter: vi.fn(async (id) => ({ ...system, id })),
	setChapterDeleted: vi.fn(async (id, isDeleted) => ({
		chapter: { ...system, id },
		isDeleted,
		operation: null
	})),
	createChapterStage: vi.fn(async (_chapterId, draft) => ({
		id: 'stage-new',
		name: draft.name,
		note: draft.note ?? '',
		start: draft.start,
		lineup: draft.lineup ?? null
	})),
	editChapterStage: vi.fn(async (id) => ({ ...system.stages[0], id })),
	setChapterStageDeleted: vi.fn(async (id, isDeleted) => ({
		stage: { ...system.stages[0], id },
		chapterId: system.id,
		isDeleted,
		operation: null
	})),
	subscribeChapters: vi.fn(() => () => {}),
	...overrides
});

describe('the chapters store', () => {
	it('with no chapter leaves the rows, the capture and the ticks as they are', () => {
		const { store } = storeOf([]);
		expect(store.driver).toBeNull();
		expect(store.arrangement).toBeNull();
		expect(store.captureGroups).toBeNull();
		expect(store.levels([])).toBeNull();
		expect(store.frontRows([])).toBeNull();
		expect(store.history('tempience')).toEqual([]);
		expect(store.showing).toBe(false);
	});

	it('lets the current chapter drive: its current stage has no lineup, so the chapter’s orders the rows', () => {
		const { store } = storeOf(chapters);
		expect(store.current?.id).toBe('system');
		expect(store.driver?.stage?.id).toBe('push');
		expect(store.arrangement?.lanes.slice(0, 3).map((lane) => lane.members)).toEqual([
			['tempience'],
			['people'],
			['body']
		]);
		// The rest folds into one merged row.
		expect(store.arrangement?.lanes).toHaveLength(4);
		expect(store.captureGroups).toEqual({
			groups: [{ label: 'system', ids: ['tempience', 'body', 'people'] }],
			rest: 'Остальные'
		});
	});

	it('follows the chapter or stage chosen, and keeps the rows’ order while the lineup stays', () => {
		const { store, selection } = storeOf(chapters);
		const before = store.arrangement;
		selection.select({ kind: 'trace', traceId: 'x' }, 'canvas');
		expect(store.arrangement).toEqual(before);
		selection.select({ kind: 'chapter', chapterId: 'system', stage: 'open' }, 'context');
		expect(store.showing).toBe(true);
		expect(store.driverKey).toBe('system:open');
		expect(store.captureGroups?.groups[0]).toEqual({
			label: 'Открытие',
			ids: ['body', 'tempience']
		});
		selection.select({ kind: 'chapter', chapterId: 'move', stage: null }, 'context');
		// A chapter with an empty lineup still drives: everything folds into the one row.
		expect(store.driver?.chapter.id).toBe('move');
		expect(store.arrangement?.lanes).toHaveLength(1);
	});

	it('keeps the chapter chosen while a record inside it is selected; a record elsewhere hands the rows to its chapter', () => {
		const at = (id: string, day: string) =>
			({
				id,
				aboutKind: 'instant',
				aboutTime: {
					basis: 'absolute',
					precision: 'day',
					certainty: 'exact',
					start: day,
					end: null
				}
			}) as unknown as ExplorerTrace;
		const traces = [
			at('inside', '2026-09-10'),
			at('earlier', '2026-07-01'),
			at('none', '2026-01-01')
		];
		const selection = new SelectionState();
		const store = new ChaptersState(() => ({ ...tree, chapters, traces }), selection);
		store.now = now;
		// No chapter chosen yet: a record of a past chapter moves no row, the current one leads.
		selection.select({ kind: 'trace', traceId: 'earlier' }, 'canvas');
		expect(store.driverKey).toBe('system:push');
		selection.select({ kind: 'chapter', chapterId: 'system', stage: 'open' }, 'context');
		expect(store.driverKey).toBe('system:open');
		// A record inside the chosen chapter: the chapter and its stage keep the rows.
		selection.select({ kind: 'trace', traceId: 'inside' }, 'canvas');
		expect(store.driverKey).toBe('system:open');
		expect(store.pick).toBeNull();
		// A record of another chapter: that chapter, whole.
		selection.select({ kind: 'trace', traceId: 'earlier' }, 'canvas');
		expect(store.driverKey).toBe('move:');
		// Back in history to the record inside: the chosen chapter again.
		selection.back();
		expect(store.driverKey).toBe('system:open');
		// A record in no chapter, or a Scope: the last chapter chosen stays.
		selection.select({ kind: 'trace', traceId: 'none' }, 'canvas');
		expect(store.driverKey).toBe('system:open');
		selection.select({ kind: 'scope', scopeId: 'work' }, 'rail');
		expect(store.driverKey).toBe('system:open');
		// «Снять выбор»: nothing is held, the current chapter leads.
		selection.rest();
		expect(store.driver?.chapter.id).toBe('system');
		expect(store.driverKey).toBe('system:push');
	});

	it('opens the form over the Context until anything else is chosen', () => {
		const { store, selection } = storeOf(chapters);
		store.edit({ mode: 'edit', chapterId: 'system' });
		expect(store.formOpen).toBe(true);
		selection.select({ kind: 'scope', scopeId: 'work' }, 'rail');
		expect(store.formOpen).toBe(false);
	});

	it('writes through the repository and shows a new chapter before the feed answers', async () => {
		const { store } = storeOf(chapters);
		const writer = writerOf();
		store.connect(writer);
		const created = await store.create({
			name: 'Пауза',
			note: '',
			colorHue: null,
			colorChroma: null,
			colorDepth: null,
			start: '2026-09-20T00:00:00+02:00',
			lineup: []
		});
		expect(created.id).toBe('new');
		expect(store.list.map((item) => item.id)).toEqual(['move', 'system', 'new', 'out']);
		expect(store.chapter('system')?.end).toBe('2026-09-20T00:00:00+02:00');
		await store.remove('new');
		expect(store.list.map((item) => item.id)).toEqual(['move', 'system', 'out']);
		expect(writer.setChapterDeleted).toHaveBeenCalledWith('new', true);
	});

	it('saves a chapter in one write: the repository moves the stage that started with it', async () => {
		const { store } = storeOf(chapters);
		const writer = writerOf();
		store.connect(writer);
		const fields = { ...system, note: '', start: '2026-09-02T00:00:00+02:00' };
		await store.save(system, fields);
		expect(writer.editChapter).toHaveBeenCalledWith('system', fields);
		expect(writer.editChapterStage).not.toHaveBeenCalled();
	});

	it('removes the first stage and lets the next one start where it did', async () => {
		const { store } = storeOf(chapters);
		const writer = writerOf();
		store.connect(writer);
		await store.removeStage(system, 'open');
		expect(writer.setChapterStageDeleted).toHaveBeenCalledWith('open', true);
		expect(writer.editChapterStage).toHaveBeenCalledWith('push', { start: system.start });
		await store.removeStage(system, 'push');
		expect(writer.editChapterStage).toHaveBeenCalledTimes(1);
	});

	it('lets the rows glide while the space has chapters, and after the last one is deleted', async () => {
		expect(storeOf([]).store.moving).toBe(false);
		const { store } = storeOf([system]);
		expect(store.moving).toBe(true);
		store.connect(writerOf());
		await store.remove('system');
		expect(store.list).toEqual([]);
		expect(store.moving).toBe(true);
	});

	it('takes the chapters from the live feed once it answers, and lets go of it', () => {
		const { store } = storeOf([]);
		let answer: (list: Chapter[]) => void = () => {};
		const stop = vi.fn();
		const disconnect = store.connect(
			writerOf({
				subscribeChapters: (next) => {
					answer = next;
					return stop;
				}
			})
		);
		expect(store.list).toEqual([]);
		answer([...chapters]);
		expect(store.list.map((item) => item.id)).toEqual(['move', 'system', 'out']);
		disconnect();
		expect(stop).toHaveBeenCalled();
	});
});
