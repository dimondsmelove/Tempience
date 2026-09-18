import { createInstance, type TOptions } from 'i18next';
import { DEFAULT_LOCALE, LOCALES } from './constants';
import type { Locale, MessageKey } from './types';
import { ru } from './messages/ru';
import { en } from './messages/en';

/** Both catalogs ship with the app: nothing is fetched, and offline works in either language. */
const messages = createInstance();
void messages.init({
	resources: { ru: { translation: ru }, en: { translation: en satisfies typeof ru } },
	lng: DEFAULT_LOCALE,
	fallbackLng: DEFAULT_LOCALE,
	supportedLngs: LOCALES.map(({ value }) => value),
	initAsync: false,
	keySeparator: false,
	interpolation: { escapeValue: false }
});

export const isLocale = (value: unknown): value is Locale =>
	LOCALES.some((entry) => entry.value === value);

/** A message in an explicit language, for adapters that format outside a component. */
export const translate = (language: Locale, key: MessageKey, options?: TOptions): string =>
	messages.t(key, { ...options, lng: language });

/** Whether the catalogs hold a key that is only known at runtime, such as an error code's. */
export const hasMessage = (key: string): key is MessageKey =>
	messages.exists(key, { lng: DEFAULT_LOCALE });
