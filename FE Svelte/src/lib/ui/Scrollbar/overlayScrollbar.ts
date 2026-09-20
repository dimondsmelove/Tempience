import type { Attachment } from 'svelte/attachments';
import './overlay.css';
import { EDGE_REVEAL_PX, HIT_WIDTH_PX, THUMB_HIDE_DELAY_MS } from './constants';
import { dragScrollTop, pageScrollTop, thumbGeometry, type ThumbGeometry } from './geometry';

/**
 * A thin accent thumb over the scroller's right edge instead of the native bar, one for every
 * scrolling surface — the ribbon, the rail, the Kind table, the Context (owner review
 * 2026-09-19, pack 3, P7): it takes no width, shows while the content moves or the pointer comes
 * to the right edge, and fades a moment after. It is a real scrollbar: the thumb is dragged
 * with the mouse (pointer capture, the travel scaled to `scrollTop`), a click on the rail pages;
 * the hit area is `HIT_WIDTH_PX` while the bar stays thin. The keyboard and touch are the
 * scroller's own, native.
 * The rail hangs off a sticky track of no height at the top of the scrollport, so the scroller
 * itself is left as it is — its position, its layout, its children's containing block — and
 * nothing is added to a flex or grid layout (a flex gap is taken back).
 */
export const overlayScrollbar: Attachment<HTMLElement> = (element) => {
	element.classList.add('overlay-scroll');
	const track = document.createElement('div');
	track.className = 'overlay-scroll-track';
	track.setAttribute('aria-hidden', 'true');
	track.style.setProperty('--overlay-hit', `${HIT_WIDTH_PX}px`);
	const style = getComputedStyle(element);
	if (style.rowGap && style.rowGap !== 'normal' && style.rowGap !== '0px')
		track.style.marginBottom = `-${style.rowGap}`;
	const rail = document.createElement('div');
	rail.className = 'overlay-scroll-rail';
	// The rail hugs the scrollport's own edges: the sticky track lives in the content box, one
	// padding in from them, so the rail reaches back up and out by the same padding.
	rail.style.top = `-${style.paddingTop}`;
	rail.style.right = `-${style.paddingRight}`;
	const thumb = document.createElement('div');
	thumb.className = 'overlay-scroll-thumb';
	rail.append(thumb);
	track.append(rail);
	element.prepend(track);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let dragging = false;
	let hovering = false;

	const geometry = (): ThumbGeometry | null =>
		thumbGeometry(element.scrollTop, element.scrollHeight, element.clientHeight);
	const place = (): boolean => {
		const at = geometry();
		if (!at) return false;
		rail.style.height = `${element.clientHeight}px`;
		thumb.style.height = `${at.heightPx}px`;
		thumb.style.top = `${at.offsetPx}px`;
		return true;
	};
	const hide = (): void => rail.classList.remove('visible');
	/** Shows the bar where it stands; it fades later unless the pointer holds it. */
	const show = (): void => {
		if (!place()) {
			hide();
			return;
		}
		rail.classList.add('visible');
		clearTimeout(hideTimer);
		if (!dragging && !hovering) hideTimer = setTimeout(hide, THUMB_HIDE_DELAY_MS);
	};
	const mouse = (event: PointerEvent): boolean =>
		event.pointerType !== 'touch' && event.button === 0;
	/**
	 * The pointer near the right edge calls the bar up, so it can be grabbed without scrolling
	 * first; only inside the strip itself is the rail armed to take the pointer — content under
	 * the strip is shadowed while the pointer is over the strip, never elsewhere.
	 */
	const reveal = (event: PointerEvent): void => {
		if (event.pointerType === 'touch') return;
		const edge = element.getBoundingClientRect().right - event.clientX;
		if (edge <= EDGE_REVEAL_PX) show();
		rail.classList.toggle('armed', dragging || (edge >= 0 && edge <= HIT_WIDTH_PX));
	};
	const disarm = (): void => {
		if (!dragging) rail.classList.remove('armed');
	};
	const enter = (): void => {
		hovering = true;
		show();
	};
	const leave = (): void => {
		hovering = false;
		show();
	};
	const grab = (event: PointerEvent): void => {
		if (!mouse(event)) return;
		event.preventDefault();
		event.stopPropagation();
		const startY = event.clientY;
		const startTop = element.scrollTop;
		const height = thumb.offsetHeight;
		dragging = true;
		rail.classList.add('dragging');
		thumb.setPointerCapture(event.pointerId);
		const move = (moved: PointerEvent): void => {
			element.scrollTop = dragScrollTop(
				startTop,
				moved.clientY - startY,
				element.scrollHeight,
				element.clientHeight,
				height
			);
		};
		const release = (moved: PointerEvent): void => {
			dragging = false;
			rail.classList.remove('dragging');
			reveal(moved);
			thumb.removeEventListener('pointermove', move);
			thumb.removeEventListener('pointerup', release);
			thumb.removeEventListener('pointercancel', release);
			show();
		};
		thumb.addEventListener('pointermove', move);
		thumb.addEventListener('pointerup', release);
		thumb.addEventListener('pointercancel', release);
	};
	const page = (event: PointerEvent): void => {
		if (event.target !== rail || !mouse(event)) return;
		event.preventDefault();
		event.stopPropagation();
		const at = geometry();
		if (!at) return;
		const offset = event.clientY - rail.getBoundingClientRect().top;
		element.scrollTop = pageScrollTop(
			element.scrollTop,
			offset,
			at,
			element.scrollHeight,
			element.clientHeight
		);
	};
	element.addEventListener('scroll', show, { passive: true });
	element.addEventListener('pointermove', reveal, { passive: true });
	element.addEventListener('pointerleave', disarm);
	rail.addEventListener('pointerenter', enter);
	rail.addEventListener('pointerleave', leave);
	rail.addEventListener('pointerdown', page);
	thumb.addEventListener('pointerdown', grab);
	const observer = new ResizeObserver(() => {
		if (rail.classList.contains('visible')) show();
	});
	observer.observe(element);
	return () => {
		clearTimeout(hideTimer);
		observer.disconnect();
		element.removeEventListener('scroll', show);
		element.removeEventListener('pointermove', reveal);
		element.removeEventListener('pointerleave', disarm);
		track.remove();
		element.classList.remove('overlay-scroll');
	};
};
