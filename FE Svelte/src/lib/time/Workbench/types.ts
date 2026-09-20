import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
import type { Panel } from '$lib/time/Toolbar/types';
import type { SheetPosition } from '$lib/ui/BottomSheet/types';

export type MobilePanelsProps = Readonly<{
	workbench: WorkbenchState;
	panel: Panel | null;
	position: SheetPosition;
	sheetHeight?: number;
	scopeContent: Snippet<[boolean]>;
	contextContent?: Snippet<[boolean]>;
	/** Adopts the workbench's one Context into the sheet while it shows the Context. */
	contextHost: Attachment<HTMLElement>;
	/** Closes the Context sheet: the workbench passes the open form's guard first. */
	oncontextclose: () => void;
	controls: Snippet<[boolean]>;
}>;

import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';

/** An opt-in input surface. The normal workbench keeps its own camera and selection commands. */
export type WorkbenchInteraction = {
	viewport: ViewportState;
	header: Snippet;
	overlay: Snippet;
	actions?: Snippet;
};
export type WorkbenchPreview = {
	context: Snippet<[boolean]>;
	interaction?: WorkbenchInteraction;
	mobileActions?: Snippet;
	contextPosition?: SheetPosition;
	oncontextposition?: (position: SheetPosition) => void;
	oncontextclose?: () => void;
};
export type TimelineSurfaceProps = {
	workbench: WorkbenchState;
	viewport: ViewportState;
	minHeightPx: number;
	rowHeightPx: number;
	phone: boolean;
	scopeContent: Snippet<[boolean]>;
	onempty: () => void;
	onscrollrows: (delta: number) => void;
	interaction?: WorkbenchInteraction;
	/** Whether the arcs of the chosen record's links are drawn: they go with the Context, the choice stays (owner 2026-09-15). */
	linksShown?: boolean;
	/** The lens veil's strength 0–1 on this device (loop 008, B); 0 turns it off. */
	veil?: number;
	element?: HTMLDivElement | null;
};
