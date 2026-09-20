import type { Petal } from '$lib/ui/BlossomPopover/types';
import type { ColorHuePickerProps } from '../ColorHuePicker/types';

/**
 * The flower takes the props of the plain picker — `{hue, chroma, depth, onpick}` over the
 * Scope's colour — so the editor swaps one import (owner decision 2026-09-19, Blossom). As a
 * `dot` (C6, D) its trigger is the Context Scope's dot beside the name, `size` px across.
 */
export type ColorBlossomPickerProps = ColorHuePickerProps &
	Readonly<{
		variant?: 'field' | 'dot';
		size?: number;
	}>;

/** A petal of the Scope palette: the shell's petal plus the degree and the depth it stands for. */
export type ScopePetal = Petal &
	Readonly<{
		/** Our hue, `PETAL_HUES[index % PETAL_COUNT]`. */
		hue: number;
		/** Our depth, the petal's ring. */
		depth: number;
	}>;
