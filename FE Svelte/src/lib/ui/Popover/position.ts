import type { Attachment } from 'svelte/attachments';
import { POPOVER_GAP_PX as gap, POPOVER_MARGIN_PX as margin } from './constants';
import type { Rect } from './types';

export const popoverPosition = (
	anchor: Rect,
	panel: { width: number; height: number },
	viewport: { width: number; height: number }
) => ({
	left: Math.max(margin, Math.min(anchor.left, viewport.width - panel.width - margin)),
	top: Math.max(
		margin,
		Math.min(
			anchor.bottom + gap + panel.height <= viewport.height - margin
				? anchor.bottom + gap
				: anchor.top - panel.height - gap,
			viewport.height - panel.height - margin
		)
	)
});

/**
 * Native popovers own focus, Escape and light-dismiss; this attachment keeps them beside the
 * trigger — on opening, on a resize or scroll, and when the panel's own size changes (content
 * that mounts once it is open, such as the colour flower).
 */
export const positionPopover: Attachment<HTMLElement> = (panel) => {
	const position = () => {
		if (!panel.matches(':popover-open')) return;
		const anchor = panel.previousElementSibling!.getBoundingClientRect();
		const { left, top } = popoverPosition(anchor, panel.getBoundingClientRect(), {
			width: innerWidth,
			height: innerHeight
		});
		panel.style.left = `${left}px`;
		panel.style.top = `${top}px`;
	};
	const observer = new ResizeObserver(position);
	observer.observe(panel);
	panel.addEventListener('toggle', position);
	window.addEventListener('resize', position);
	window.addEventListener('scroll', position, true);
	return () => {
		observer.disconnect();
		panel.removeEventListener('toggle', position);
		window.removeEventListener('resize', position);
		window.removeEventListener('scroll', position, true);
	};
};
