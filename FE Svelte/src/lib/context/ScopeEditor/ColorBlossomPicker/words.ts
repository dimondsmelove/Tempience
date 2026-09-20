import type { TOptions } from 'i18next';
import type { MessageKey } from '$lib/state/Locale/types';
import { DEFAULT_CHROMA, DEFAULT_DEPTH } from '$lib/theme/scope-colour';
import { DOT_KEY, DOT_SET_KEY, NO_COLOUR_KEY, PETAL_KEY, READOUT_KEY } from './constants';

/** A message in the language of the moment — `t` of the locale, or `translate` bound to one. */
export type Say = (key: MessageKey, options?: TOptions) => string;

/** The colour in words for readers: «Оттенок N° · глубина D · насыщенность M», or «Без цвета». */
export const colourReadout = (
	say: Say,
	hue: number | null,
	chroma: number | null,
	depth: number | null
): string =>
	hue === null
		? say(NO_COLOUR_KEY)
		: say(READOUT_KEY, { h: hue, d: depth ?? DEFAULT_DEPTH, s: chroma ?? DEFAULT_CHROMA });

/** A petal's name for readers: its hue and its depth. */
export const petalName = (say: Say, hue: number, depth: number): string =>
	say(PETAL_KEY, { h: hue, d: depth });

/**
 * The Context Scope's dot as a button (C6, D): named «Цвет Scope: …» with the colour's words,
 * or «Задать цвет Scope» while the Scope has none — the same slot, a transparent button.
 */
export const dotName = (
	say: Say,
	hue: number | null,
	chroma: number | null,
	depth: number | null
): string =>
	hue === null ? say(DOT_SET_KEY) : say(DOT_KEY, { words: colourReadout(say, hue, chroma, depth) });
