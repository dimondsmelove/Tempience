import type { Locale } from '$lib/state/Locale/types';

/** The language names the control speaks: the picker's own labels, one per interface language. */
export type LanguageName = (value: Locale) => string;
