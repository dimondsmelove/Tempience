import { endOf } from './Chapters';
import { ms } from './time';
import type { Chapter, Stage, StagePick, StageWindow } from './types';

/** Stages: contiguous stretches inside a chapter, each until the next one starts. */

const byStart = (a: Stage, b: Stage): number => ms(a.start) - ms(b.start);

/** The stages in time, each until the next one starts or the chapter ends. */
export const stageWindows = (chapter: Chapter): StageWindow[] => {
	const stages = chapter.stages.toSorted(byStart);
	return stages.map((stage, index) => ({
		stage,
		start: ms(stage.start),
		end: index + 1 < stages.length ? ms(stages[index + 1].start) : endOf(chapter)
	}));
};

/** The stage that holds an instant, or null before the first one or outside the chapter. */
export const stageAt = (chapter: Chapter, at: number): Stage | null =>
	stageWindows(chapter).find((item) => item.start <= at && (item.end === null || at < item.end))
		?.stage ?? null;

/**
 * Where a stage may start: after the stage before it and before the one after it, inside the
 * chapter. The first stage starting with the chapter stays there, so the stages stay contiguous.
 */
export const stageBounds = (
	chapter: Chapter,
	stageId: string
): Readonly<{ min: number; max: number | null; locked: boolean; first: boolean }> => {
	const windows = stageWindows(chapter);
	const index = windows.findIndex((item) => item.stage.id === stageId);
	const start = ms(chapter.start);
	const before = windows[index - 1];
	const after = windows[index + 1];
	return {
		min: before ? before.start : start,
		max: after ? after.start : endOf(chapter),
		locked: index === 0 && windows[0]?.start === start,
		first: index === 0
	};
};

/**
 * A stage taken out: the stage before it runs on over its time; when the first one goes, the
 * next one starts where it did, so the stages stay contiguous. Records are not touched.
 */
export const removeStage = (chapter: Chapter, stageId: string): Chapter => {
	const sorted = chapter.stages.toSorted(byStart);
	const index = sorted.findIndex((stage) => stage.id === stageId);
	if (index < 0) return chapter;
	const rest = sorted.filter((stage) => stage.id !== stageId);
	if (index === 0 && rest.length) rest[0] = { ...rest[0], start: sorted[0].start };
	return { ...chapter, stages: rest };
};

/**
 * The rail header's ‹ › under the chapter: the pick one step before or after the stage in force
 * (none — the whole chapter), in the order of the Context strip: «Вся глава», then the stages in
 * time. Undefined at either end: the steps do not leave the chapter.
 */
export const stageStep = (
	chapter: Chapter,
	inForce: Stage | null,
	delta: -1 | 1
): Exclude<StagePick, null> | undefined => {
	const steps = ['whole', ...chapter.stages.toSorted(byStart).map((stage) => stage.id)];
	const index = steps.indexOf(inForce?.id ?? 'whole');
	return index < 0 ? undefined : steps[index + delta];
};

/**
 * The stage in force for a pick: none for the whole chapter, the chosen one, or — with nothing
 * chosen — the stage current at `now` (none outside the chapter or before its first stage).
 */
export const stageInForce = (chapter: Chapter, pick: StagePick, now: number): Stage | null =>
	pick === 'whole'
		? null
		: pick
			? (chapter.stages.find((item) => item.id === pick) ?? null)
			: stageAt(chapter, now);
