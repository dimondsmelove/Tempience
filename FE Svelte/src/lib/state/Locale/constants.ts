/** The interface language is a browser preference, kept apart from data spaces and content. */
export const DEFAULT_LOCALE = 'ru';
export const LOCALE_STORAGE_KEY = 'tempience-locale';
export const LOCALES = [
	{ value: 'ru', label: 'Русский' },
	{ value: 'en', label: 'English' }
] as const;
