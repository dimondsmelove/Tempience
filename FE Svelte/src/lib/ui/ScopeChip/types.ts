import type { Snippet } from 'svelte';
import type { HoverTarget } from '$lib/model/Hover/types';

/** What a chip needs of a Scope: a name and the colour pair that tints it; a `null` hue is ink. */
export type ChipScope = Readonly<{
	id: string;
	name: string;
	colorHue?: number | null;
	colorChroma?: number | null;
	colorDepth?: number | null;
}>;

export type ScopeChipProps = Readonly<{
	id: string;
	name: string;
	/** The Scope's hue (0–359): the whole chip takes the tint in the current mode; `null` leaves it neutral. */
	colorHue?: number | null;
	/** The Scope's saturation 0–100; `null` is the default. */
	colorChroma?: number | null;
	/** The Scope's depth 0–2; `null` is 0. */
	colorDepth?: number | null;
	/** Ancestors, root first, shown muted before the name. */
	path?: readonly Readonly<{ id: string; name: string }>[];
	/** A chip that leads somewhere: every name in it, ancestors included, is a button. */
	onopen?: (scopeId: string) => void;
	/** The accessible name of the leaf button when its text alone does not say what it does. */
	openLabel?: string;
	openTestId?: string;
	/** A chip that can be taken away: a small × after the name. */
	onremove?: () => void;
	removeLabel?: string;
	removeTestId?: string;
	/** A test id on the chip as a whole; the leaf button carries `openTestId`. */
	testId?: string;
	disabled?: boolean;
	/** Emphasis from outside (hover linking): the rounded accent underline along the chip's bottom edge. */
	lit?: boolean;
	/**
	 * What the chip lights on the ribbon under the pointer or the focus (loop 008, C3): the Scope
	 * itself unless said otherwise — a period's chip names its records in that Scope; `null` lights nothing.
	 */
	lens?: HoverTarget;
	/** More actions between the name and the ×, as small icon buttons. */
	children?: Snippet;
}>;
