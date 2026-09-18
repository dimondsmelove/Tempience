import type { Attachment } from 'svelte/attachments';
import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';

/**
 * Drives `viewport.tick()` every frame while following «сейчас». Reading
 * `viewport.follow` inside the attachment makes it re-run when following
 * toggles, so the loop starts and stops with the flag.
 */
export const followClock =
	(viewport: ViewportState): Attachment<HTMLElement> =>
	() => {
		if (!viewport.follow) return;
		let frame = requestAnimationFrame(function loop() {
			viewport.tick();
			frame = requestAnimationFrame(loop);
		});
		return () => cancelAnimationFrame(frame);
	};
