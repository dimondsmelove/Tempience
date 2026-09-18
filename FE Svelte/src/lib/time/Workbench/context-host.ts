import type { Attachment } from 'svelte/attachments';

/**
 * Moves the workbench's one Context (its parked DOM subtree) into the host that shows it —
 * the desktop panel or the phone sheet — and parks it again when that host goes. The nodes
 * are never re-created, so an open form keeps the text the browser has not parsed yet.
 */
export const adoptContext =
	(keeper: HTMLElement | null, parking: HTMLElement | null): Attachment<HTMLElement> =>
	(host) => {
		if (!keeper) return;
		host.appendChild(keeper);
		return () => {
			parking?.appendChild(keeper);
		};
	};
