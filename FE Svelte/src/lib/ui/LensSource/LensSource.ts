import { getContext, setContext } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import { hoverKey } from '$lib/model/Hover/Hover';
import type { HoverTarget } from '$lib/model/Hover/types';
import type { HoverState } from '$lib/state/Hover/Hover.svelte';
import { LENS_ATTRIBUTE, TOUCH_FOCUS_GRACE_MS } from './constants';
import type { LeaveEvent, LensElement, LensHover } from './types';

const key = Symbol('lens');

/** The workbench's hover, offered to every reference under it: the Context, the filters, the forms. */
export const provideLens = (hover: HoverState): HoverState => setContext(key, hover);

/** The hover a reference lights, or null outside the workbench (a form on its own route lights nothing). */
export const getLens = (): HoverState | null => getContext<HoverState | undefined>(key) ?? null;

/** What every attached element lights, so a leave that lands inside an outer source (a chip in a row) hands over to it. */
const sources = new WeakMap<object, HoverTarget>();

/** The source the pointer or the focus landed in, if any: the closest attached ancestor of where it went. */
const sourceAt = (landed: EventTarget | null): HoverTarget => {
	const element = (landed as Element | null)?.closest?.(`[${LENS_ATTRIBUTE}]`);
	return element ? (sources.get(element) ?? null) : null;
};

/**
 * Makes an element that names a record, a Scope, a period, a link or a Kind a source of the
 * lens (loop 008, C3): while the pointer rests on it, or the keyboard focus is in it, the
 * ribbon and the rail show what it names above the veil, as they do for a mark or a row name.
 * The hover is released only when it is still this source's — a later source has taken over
 * otherwise — and hands over to the source the pointer left into, so a chip inside a row
 * gives the row back. A finger has nothing to hover with: touch pointers are ignored, and the
 * focus a tap leaves behind lights nothing. Detaching (the view swapped, the Context closed)
 * releases the hover the same way. A blur is released a microtask later: Chromium blurs a
 * focused element as it removes it, inside the block that removes it, where no state may
 * change — by then the detach has cleared the hover, and an ordinary blur reads the same.
 * `null` for either argument attaches nothing.
 */
export const lensSource = (
	hover: LensHover | null,
	target: HoverTarget
): Attachment<LensElement> | undefined => {
	if (!hover || !target) return undefined;
	return (element) => {
		const own = hoverKey(target);
		element.setAttribute(LENS_ATTRIBUTE, own);
		sources.set(element, target);
		const release = (event: LeaveEvent): void => {
			if (hoverKey(hover.target) !== own) return;
			hover.set(sourceAt(event.relatedTarget));
		};
		let touchedAt = -Infinity;
		const onpointerdown = (event: PointerEvent): void => {
			if (event.pointerType === 'touch') touchedAt = event.timeStamp;
		};
		const onpointerenter = (event: PointerEvent): void => {
			if (event.pointerType !== 'touch') hover.set(target);
		};
		const onpointerleave = (event: PointerEvent): void => {
			if (event.pointerType !== 'touch') release(event);
		};
		const onfocusin = (event: FocusEvent): void => {
			if (event.timeStamp - touchedAt > TOUCH_FOCUS_GRACE_MS) hover.set(target);
		};
		const onfocusout = (event: FocusEvent): void => {
			const relatedTarget = event.relatedTarget;
			queueMicrotask(() => release({ relatedTarget }));
		};
		element.addEventListener('pointerdown', onpointerdown);
		element.addEventListener('pointerenter', onpointerenter);
		element.addEventListener('pointerleave', onpointerleave);
		element.addEventListener('focusin', onfocusin);
		element.addEventListener('focusout', onfocusout);
		return () => {
			element.removeEventListener('pointerdown', onpointerdown);
			element.removeEventListener('pointerenter', onpointerenter);
			element.removeEventListener('pointerleave', onpointerleave);
			element.removeEventListener('focusin', onfocusin);
			element.removeEventListener('focusout', onfocusout);
			element.removeAttribute(LENS_ATTRIBUTE);
			sources.delete(element);
			if (hoverKey(hover.target) === own) hover.clear();
		};
	};
};
