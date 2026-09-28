import type { StageWindow } from '$lib/model/Chapters/types';
import { DAY_MS, MIN_GROW } from './constants';

/** Where «сейчас» stands inside a stage's segment, 0–100; null outside it. */
export const nowIn = (item: StageWindow, now: number, stripEnd: number): number | null => {
	const until = item.end ?? stripEnd;
	return now >= item.start && now < until
		? ((now - item.start) / (until - item.start)) * 100
		: null;
};

/** A segment as wide as its time in days, never nothing: a stage of an hour still shows. */
export const growOf = (item: StageWindow, stripEnd: number): number =>
	Math.max(((item.end ?? stripEnd) - item.start) / DAY_MS, MIN_GROW);
