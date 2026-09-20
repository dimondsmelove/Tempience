import type { HoverState } from '$lib/state/Hover/Hover.svelte';

/** What a lens source reads and writes of the hover: the workbench's `HoverState`, or a stand-in under test. */
export type LensHover = Pick<HoverState, 'target' | 'set' | 'clear'>;

/**
 * What the attachment touches of its element: listeners and the `data-lens` attribute. Kept
 * to this surface so a fake element can drive the attachment in a unit test without a DOM.
 */
export type LensElement = Pick<
	HTMLElement,
	'addEventListener' | 'removeEventListener' | 'dispatchEvent' | 'setAttribute' | 'removeAttribute'
>;

/** What a leave event says about where the pointer or the focus went: enough to find the source it landed in. */
export type LeaveEvent = Readonly<{ relatedTarget: EventTarget | null }>;
