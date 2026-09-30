import type { StageWindow } from '$lib/model/Chapters/types';

/** Where «сейчас» stands inside a stage's segment, 0–100; null outside it. */
export const nowIn = (item: StageWindow, now: number, stripEnd: number): number | null => {
	const until = item.end ?? stripEnd;
	return now >= item.start && now < until
		? ((now - item.start) / (until - item.start)) * 100
		: null;
};
