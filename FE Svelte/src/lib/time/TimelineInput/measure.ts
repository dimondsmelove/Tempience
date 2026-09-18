import type { Attachment } from 'svelte/attachments';

/**
 * Reports an element's height to the store whenever it changes, and 0 once
 * the element leaves, so the rows can be given the room that is left (C9a-2).
 * ResizeObserver delivers the first measurement on observe; nothing is
 * written synchronously from the attachment itself. `inner` reads the
 * client height (a scroller's viewport) instead of the border box.
 */
export const observeHeight =
	(report: (px: number) => void, inner = false): Attachment<HTMLElement> =>
	(element) => {
		const observer = new ResizeObserver(() =>
			report(inner ? element.clientHeight : element.getBoundingClientRect().height)
		);
		observer.observe(element);
		return () => {
			observer.disconnect();
			report(0);
		};
	};

export const observeWidth =
	(report: (px: number) => void): Attachment<HTMLElement> =>
	(element) => {
		const observer = new ResizeObserver(() => report(element.clientWidth));
		observer.observe(element);
		return () => {
			observer.disconnect();
			report(0);
		};
	};
