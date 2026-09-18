import type { Attachment } from 'svelte/attachments';
import './overlay.css';
import { THUMB_HIDE_DELAY_MS, THUMB_MIN_HEIGHT_PX } from './constants';

export type ThumbGeometry = Readonly<{ heightPx: number; offsetPx: number }>;

/**
 * Where the thumb stands for a scroller: its height is the visible share of the content,
 * its offset the scrolled share of what is left, never shorter than a grabbable minimum.
 * Null when there is nothing to scroll.
 */
export const thumbGeometry = (
	scrollTop: number,
	scrollHeight: number,
	clientHeight: number,
	minHeightPx = THUMB_MIN_HEIGHT_PX
): ThumbGeometry | null => {
	const hidden = scrollHeight - clientHeight;
	if (hidden <= 0 || clientHeight <= 0) return null;
	const heightPx = Math.max(
		minHeightPx,
		Math.min(clientHeight, (clientHeight * clientHeight) / scrollHeight)
	);
	const offsetPx = (Math.min(Math.max(scrollTop, 0), hidden) / hidden) * (clientHeight - heightPx);
	return { heightPx, offsetPx };
};

/**
 * A thin accent thumb over the scroller's right edge instead of the native bar: it takes no
 * width, shows while the content moves and fades a moment after it stops (owner, 2026-09-18).
 * The thumb hangs off a sticky track of no height at the top of the scrollport, so the
 * scroller itself is left as it is — its position, its layout, its children's containing
 * block — and nothing is added to a flex or grid layout (a flex gap is taken back).
 */
export const overlayScrollbar: Attachment<HTMLElement> = (element) => {
	element.classList.add('overlay-scroll');
	const track = document.createElement('div');
	track.className = 'overlay-scroll-track';
	track.setAttribute('aria-hidden', 'true');
	const gap = getComputedStyle(element).rowGap;
	if (gap && gap !== 'normal' && gap !== '0px') track.style.marginBottom = `-${gap}`;
	const thumb = document.createElement('div');
	thumb.className = 'overlay-scroll-thumb';
	track.append(thumb);
	element.prepend(track);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	const place = (): boolean => {
		const geometry = thumbGeometry(element.scrollTop, element.scrollHeight, element.clientHeight);
		if (!geometry) return false;
		thumb.style.height = `${geometry.heightPx}px`;
		thumb.style.top = `${geometry.offsetPx}px`;
		return true;
	};
	const show = (): void => {
		if (!place()) {
			thumb.classList.remove('visible');
			return;
		}
		thumb.classList.add('visible');
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => thumb.classList.remove('visible'), THUMB_HIDE_DELAY_MS);
	};
	element.addEventListener('scroll', show, { passive: true });
	const observer = new ResizeObserver(() => {
		if (thumb.classList.contains('visible')) show();
	});
	observer.observe(element);
	return () => {
		clearTimeout(hideTimer);
		observer.disconnect();
		element.removeEventListener('scroll', show);
		track.remove();
		element.classList.remove('overlay-scroll');
	};
};
