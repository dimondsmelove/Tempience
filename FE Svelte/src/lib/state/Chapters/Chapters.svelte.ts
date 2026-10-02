import type { ScopeColour } from '$lib/theme/scope-colour';
import {
	browserTimeZone,
	chapterArrangement,
	covers,
	currentChapter,
	driverOf,
	foregroundRowIds,
	historyOf,
	idsAt,
	lineupNesting,
	nextBoundary,
	ordered,
	removeStage,
	resolveEnds,
	rowLevels,
	shadowMembers,
	shadowRowIds,
	withDescendants
} from '$lib/model/Chapters';
import type {
	Chapter,
	Driver,
	HistoryTick,
	Level,
	Lineup,
	StagePick
} from '$lib/model/Chapters/types';
import { traceMarkTime } from '$lib/model/Projection/marks';
import type { RowArrangement } from '$lib/model/Arrangement/types';
import type { ProjectedRow } from '$lib/model/Projection/types';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { locale } from '$lib/state/Locale/Locale.svelte';
import { translate } from '$lib/state/Locale/messages';
import type { SelectionState } from '$lib/state/Selection/Selection.svelte';
import { MAX_TIMER_MS, ROWS_OFF_STORAGE_KEY } from './constants';
import type {
	CaptureGroups,
	ChapterEditing,
	ChapterFields,
	ChapterWriter,
	StageFields
} from './types';

type Tree = Pick<ExplorerSnapshot, 'scopes' | 'intersections'>;
/** What the chapters read of the view: their own list, the Scope tree, and the records' times. */
type View = Pick<ExplorerSnapshot, 'chapters'> & Tree & Partial<Pick<ExplorerSnapshot, 'traces'>>;
type ChapterPick = Readonly<{ chapterId: string; stage: StagePick }>;

/**
 * The chapters of the active space (issue #82): they frame the Time workbench wherever they
 * exist. Read live from Triplit once connected, else from the snapshot; written through the
 * repository. With no chapter in force nothing here touches the rows, the capture or the
 * selection: the workbench is as it was.
 */
/** Whether this device keeps its own row order under a chapter; off when storage cannot say. */
const storedRowsOff = (): boolean => {
	try {
		return localStorage.getItem(ROWS_OFF_STORAGE_KEY) === '1';
	} catch {
		return false;
	}
};

export class ChaptersState {
	/** The chapters as the live feed answered last; null before it answers (the snapshot's stand in). */
	live = $state.raw<readonly Chapter[] | null>(null);
	/**
	 * «Сейчас» for chapters and stages: it moves at the next boundary — a chapter's start or end,
	 * a stage's start — by one timer set for it, and when the tab is shown again.
	 */
	now = $state(Date.now());
	private timer: ReturnType<typeof setTimeout> | undefined;
	/** The zone chapter boundaries are set and read in: the browser's own, as records use. */
	readonly timeZone = browserTimeZone();
	/** The chapter form in the Context, and the selection revision it was opened at. */
	editing = $state.raw<(ChapterEditing & { revision: number }) | null>(null);
	/** The space had chapters in this session: rows keep gliding when the last one goes. */
	private had = $state(false);
	private writer: ChapterWriter | null = null;
	private readonly view: () => View;
	private readonly selection: SelectionState;
	/** How a chapter form takes the Context: the workbench ends every other form first. */
	private readonly takeContext: (then: () => void) => void;
	private readonly device: () => RowArrangement | null;

	constructor(
		view: () => View,
		selection: SelectionState,
		takeContext: (then: () => void) => void = (then) => then(),
		/** The device's own rows: a chapter keeps their order and only chooses (owner 2026-09-28). */
		device: () => RowArrangement | null = () => null
	) {
		this.view = view;
		this.selection = selection;
		this.takeContext = takeContext;
		this.device = device;
	}

	/** The chapters in time, their ends derived. */
	readonly list: readonly Chapter[] = $derived.by(() => this.live ?? this.view().chapters ?? []);

	/**
	 * The rows glide to their new places, in the rail and on the ribbon alike: while the space has
	 * chapters (a lineup re-orders them), and after the last one is deleted, so leaving it glides too.
	 */
	readonly moving: boolean = $derived.by(() => this.had || this.list.length > 0);

	/**
	 * Writes go through `writer`, its feed keeps `live`, and «сейчас» follows the clock; what is
	 * returned ends all three.
	 */
	connect(writer: ChapterWriter): () => void {
		this.writer = writer;
		const stop = writer.subscribeChapters(
			(chapters) => {
				if (this.list.length) this.had = true;
				this.live = chapters;
				this.tick();
			},
			(error) => console.warn('[tempience:chapters] the chapters feed failed', error)
		);
		const visible = (): void => {
			if (document.visibilityState === 'visible') this.tick();
		};
		if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible);
		this.tick();
		return () => {
			stop();
			clearTimeout(this.timer);
			if (typeof document !== 'undefined')
				document.removeEventListener('visibilitychange', visible);
			this.writer = null;
		};
	}

	/** «Сейчас» read again, and one timer set for the next boundary after it — no polling. */
	tick(): void {
		clearTimeout(this.timer);
		this.now = Date.now();
		const next = nextBoundary(this.list, this.now);
		if (next === null) return;
		this.timer = setTimeout(() => this.tick(), Math.min(next - this.now, MAX_TIMER_MS));
	}

	chapter(id: string | null | undefined): Chapter | null {
		return this.list.find((chapter) => chapter.id === id) ?? null;
	}

	/** The chapter whose window holds «сейчас». */
	readonly current: Chapter | null = $derived(currentChapter(this.list, this.now));

	/**
	 * The chapter the rows follow (owner 2026-09-29, revised 2026-10-02), read along the history
	 * up to the entry it stands on. A chapter chosen holds, with its stage. A record dated inside
	 * the chapter holding keeps it, so a click inside moves no row; a record dated in another
	 * chapter hands the rows to that chapter — with the stage chosen there before, else whole —
	 * also when no chapter was chosen yet. A record without a date or outside every chapter, a
	 * Scope, a Period keep what holds. At rest («Снять выбор», a closed Context) the history's
	 * entry still holds, so closing moves no row. With no history — none: the current chapter
	 * leads.
	 */
	private readonly held: ChapterPick | null = $derived.by(() => {
		const selection = this.selection;
		const traces = this.view().traces ?? [];
		let held: ChapterPick | null = null;
		let chosen: ChapterPick | null = null;
		for (const entry of selection.entries.slice(0, selection.index + 1)) {
			if (entry.kind === 'chapter') {
				held = chosen = { chapterId: entry.chapterId, stage: entry.stage };
				continue;
			}
			if (entry.kind !== 'trace') continue;
			const trace = traces.find((item) => item.id === entry.traceId);
			const at = trace ? (traceMarkTime(trace, this.now)?.start ?? null) : null;
			if (at === null) continue;
			const holding = this.chapter(held?.chapterId);
			if (holding && covers(holding, at)) continue;
			const own = this.list.find((chapter) => covers(chapter, at));
			if (own) held = chosen?.chapterId === own.id ? chosen : { chapterId: own.id, stage: 'whole' };
		}
		return held;
	});

	/**
	 * Who orders the rows: the chosen stage's own lineup; with no stage chosen, the driving
	 * chapter's current stage if it has one; else the chapter's lineup. Null — the rows are the device's.
	 */
	readonly driver: Driver | null = $derived.by(() => {
		const pick = this.held;
		const chosen = this.chapter(pick?.chapterId);
		const chapter = chosen ?? this.current;
		return chapter ? driverOf(chapter, chosen ? pick!.stage : null, this.now) : null;
	});
	/** The lineup in force, kept by reference while it stays the same: the rows re-order only on a change. */
	/**
	 * «Мой порядок строк» (owner 2026-09-28): the chapter stays chosen and its Context open, but
	 * the rows are the device's own again, until the button is pressed once more.
	 */
	rowsOff = $state(storedRowsOff());

	toggleRows(): void {
		this.rowsOff = !this.rowsOff;
		try {
			localStorage.setItem(ROWS_OFF_STORAGE_KEY, this.rowsOff ? '1' : '');
		} catch {
			// Storage refused: the choice holds for this page only.
		}
	}

	private readonly lineup: Lineup | null = $derived(
		this.rowsOff ? null : (this.driver?.lineup ?? null)
	);
	/** The Scopes in front: the driving lineup with everything under it. */
	private readonly foreground: ReadonlySet<string> | null = $derived.by(() =>
		this.lineup ? withDescendants(idsAt(this.lineup), this.view()) : null
	);
	/** The rows as the driving lineup orders them — focus, support, the rest in one row — or null. */
	readonly arrangement: RowArrangement | null = $derived.by(() =>
		this.lineup ? chapterArrangement(this.lineup, this.view(), this.device(), this.restOpen) : null
	);
	/** The lineup Scopes inside each lineup Scope, under its arrow (owner 2026-09-28). */
	readonly nested: ReadonlyMap<string, readonly string[]> | null = $derived.by(() =>
		this.lineup ? lineupNesting(this.lineup, this.view()).under : null
	);
	/** The Scopes folded into the shadow's row: the rail knows that row by them. */
	readonly restMembers: ReadonlySet<string> = $derived.by(() =>
		shadowMembers(this.arrangement, this.lineup ? idsAt(this.lineup) : [])
	);
	/** The shadow's row unfolded by its arrow: what went into it can be looked at (owner 2026-09-28). */
	restOpen = $state(false);

	toggleRest(): void {
		this.restOpen = !this.restOpen;
	}

	/** The unfolded shadow's own rows: they read quieter than the lineup, as the lab dimmed them. */
	shadowRows(rows: readonly ProjectedRow[]): Set<string> | null {
		const front = this.frontRows(rows);
		return front && this.restOpen ? shadowRowIds(rows, front) : null;
	}

	/** A key that changes whenever the rows' order would: the rail and the lanes move on it. */
	get driverKey(): string {
		const driver = this.driver;
		return driver && !this.rowsOff ? `${driver.chapter.id}:${driver.stage?.id ?? ''}` : '';
	}

	/** The chapter chosen in the Context's history, with its strip's pick; null for anything else. */
	get pick() {
		return this.selection.chapter;
	}

	/** The chapter form is open and nothing was chosen since it opened. */
	get formOpen(): boolean {
		return this.editing !== null && this.editing.revision === this.selection.revision;
	}

	/** The Context shows a chapter: one chosen, or the chapter form. */
	get showing(): boolean {
		return this.pick !== null || this.formOpen;
	}

	/** The chapter form, over whatever the Context stands on; any other choice ends it. */
	edit(editing: ChapterEditing): void {
		this.takeContext(() => {
			this.editing = { ...editing, revision: this.selection.revision };
		});
	}

	closeForm(): void {
		this.editing = null;
	}

	/** The rows standing for the lineup's Scopes, or null while no chapter orders them. */
	frontRows(rows: readonly ProjectedRow[]): Set<string> | null {
		return this.foreground ? foregroundRowIds(rows, this.foreground, this.restMembers) : null;
	}

	/** Each front row's level: focus rows read heavier, the rest of the lineup quieter. */
	levels(rows: readonly ProjectedRow[]): Map<string, Level> | null {
		return this.lineup ? rowLevels(rows, this.lineup, this.view()) : null;
	}

	/** A Scope's chapter history at its rail row, up to the driving chapter. */
	history(scopeId: string | null): HistoryTick[] {
		const driver = this.driver;
		return driver && scopeId ? historyOf(this.list, driver.chapter, scopeId) : [];
	}

	/** The record form's Scope picker: the driving lineup first, then the rest; null — as it is. */
	get captureGroups(): CaptureGroups | null {
		const driver = this.driver;
		if (!driver || !driver.lineup.length) return null;
		// One group, named by what drives, in the rows' order: no «фокус» / «поддержка» words.
		return {
			groups: [
				{
					label: driver.stage?.lineup ? driver.stage.name : driver.chapter.name,
					ids: ordered(driver.lineup).map((entry) => entry.scopeId)
				}
			],
			rest: translate(locale.current, 'chapter.captureRest')
		};
	}

	private get repository(): ChapterWriter {
		if (!this.writer) throw new Error('Chapters are not connected to a repository');
		return this.writer;
	}

	/** A chapter written back at once, before the feed answers: what the Context opens next reads it. */
	private settle(chapter: Chapter): Chapter {
		this.live = resolveEnds([...this.list.filter((item) => item.id !== chapter.id), chapter]);
		this.tick();
		return chapter;
	}

	/** A new chapter; the one it starts inside ends there by derivation. */
	async create(fields: ChapterFields): Promise<Chapter> {
		return this.settle(await this.repository.createChapter(fields));
	}

	/** A chapter's fields; the repository moves a stage that started with the chapter along. */
	async save(chapter: Chapter, fields: ChapterFields): Promise<Chapter> {
		return this.settle(await this.repository.editChapter(chapter.id, fields));
	}

	/** «Удалить главу»: its stages go with it; the one before runs on over its time. */
	async remove(chapterId: string): Promise<void> {
		await this.repository.setChapterDeleted(chapterId, true);
		this.had = true;
		this.live = resolveEnds(this.list.filter((item) => item.id !== chapterId));
		this.tick();
	}

	/** «Закрыть главу»: it ends at `at` even with no chapter after it. */
	async close(chapterId: string, at: string): Promise<Chapter> {
		return this.settle(await this.repository.editChapter(chapterId, { closedAt: at }));
	}

	/** The chapter's colour alone, picked on its dot as a Scope's is (owner 2026-09-28): no form. */
	async recolour(chapterId: string, colour: ScopeColour | null): Promise<Chapter> {
		return this.settle(
			await this.repository.editChapter(chapterId, {
				colorHue: colour?.hue ?? null,
				colorChroma: colour?.chroma ?? null,
				colorDepth: colour?.depth ?? null
			})
		);
	}

	/** A new stage of a chapter, or a stage's fields; the new stage's id. */
	async saveStage(chapter: Chapter, stageId: string | null, fields: StageFields): Promise<string> {
		if (stageId) {
			await this.repository.editChapterStage(stageId, fields);
			return stageId;
		}
		return (await this.repository.createChapterStage(chapter.id, fields)).id;
	}

	/**
	 * A stage taken out: the stage before it runs on over its time; when the first one goes, the
	 * next one starts where it did, so the stages stay contiguous. Records are not touched.
	 */
	async removeStage(chapter: Chapter, stageId: string): Promise<void> {
		const after = removeStage(chapter, stageId);
		await this.repository.setChapterStageDeleted(stageId, true);
		const moved = after.stages.find(
			(stage) => stage.start !== chapter.stages.find((item) => item.id === stage.id)?.start
		);
		if (moved) await this.repository.editChapterStage(moved.id, { start: moved.start });
	}
}
