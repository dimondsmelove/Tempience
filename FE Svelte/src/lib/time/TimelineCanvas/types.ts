import type { ScopeColour } from '$lib/theme/scope-colour';
import type { FocusSet } from '$lib/model/Focus/types';
import type { HoverTarget } from '$lib/model/Hover/types';
import type { LensSet } from '$lib/model/Lens/types';
import type { ProjectedRow, TimeRange, TraceLink } from '$lib/model/Projection/types';
import type { CanvasPulse } from '$lib/model/Pulse/types';

/** Where a selection was made; only choices made off the canvas move the window (DP7). */
export type SelectSource = 'canvas' | 'twin' | 'rail' | 'context' | 'history' | 'axis' | 'parked';

export type TimelineCanvasProps = Readonly<{
	rows: readonly ProjectedRow[];
	window: TimeRange;
	/** Epoch milliseconds of «сейчас». */
	now: number;
	selectedTraceId: string | null;
	/** Every explicit link between records: the lens brackets the hovered record's whenever it is hovered. */
	links: readonly TraceLink[];
	/** The selected record's brackets and the link rank of the caption budget go with the Context (owner 2026-09-15). */
	linksShown: boolean;
	/** Records in full force with their captions forced (by traceId): the focus and the lens as one (п. 5; loop 008). */
	lit: ReadonlySet<string>;
	/** What the Context keeps in view (loop 008, A): a period's column stays on the ribbon. */
	focus: FocusSet;
	/** What the pointer rests on, and what the lens draws above the veil for it (loop 008, B). */
	hover: HoverTarget;
	lens: LensSet;
	/** The veil's strength 0–1 (`DeviceAppearance.lens / 100`); 0 turns the veil off. */
	veil: number;
	/** The camera is moving: the hover target holds still until it settles (loop 008, B). */
	moving: boolean;
	/** «Куда смотреть» (loop 008, C3): a ring grows once around every projection of these records; null when none. */
	pulse: CanvasPulse | null;
	/** Records the search does not match (by traceId): 18 % on the ribbon (п. 9). */
	dimmed: ReadonlySet<string>;
	/** A search is on: the matches' captions are forced. */
	searching: boolean;
	/** Height of every row, shared with the Scope rail (C9a-2). */
	rowHeightPx: number;
	minHeightPx?: number;
	onselect: (traceId: string, source: SelectSource) => void;
	/**
	 * The pointer moved onto a record or off one; a row's band hovers nothing (п. 14/15), touch never
	 * hovers. Held still while the camera moves, a drag or a wheel is in progress and for a moment
	 * after the last wheel notch; leaving the canvas clears at once.
	 */
	onhover: (target: HoverTarget) => void;
	/** Several records under one click: the window should close in on their range. */
	onzoomto: (range: TimeRange, traceIds: readonly string[]) => void;
	/** A clean click on empty canvas (no mark, no caption); a drag never gets here. */
	onempty?: () => void;
}>;

/** Colours the ribbon reads from the surrounding theme once per appearance change. */
export type CanvasPalette = Readonly<{
	ink: string;
	inkSecondary: string;
	muted: string;
	accent: string;
	accentMuted: string;
	border: string;
	borderStrong: string;
	surface: string;
	/** The page behind the ribbon (`--cg-bg-canvas`): the plate under a forced caption. */
	canvas: string;
	/** The secondary accent (`--cg-accent-secondary`): the tint of the future (п. 6). */
	secondary: string;
	secondaryInk: string;
	/** The colour of a Scope colour on the theme's base (`theme/scope-colour.ts`), memoised there. */
	scope: (colour: ScopeColour) => string;
	sans: string;
	mono: string;
}>;

export type CanvasMetrics = Readonly<{
	/** Caption size in CSS pixels, from `--cg-text-size-caption`. */
	captionPx: number;
}>;
