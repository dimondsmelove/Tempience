import type { LOCALES } from './constants';
import type { ru } from './messages/ru';

export type Locale = (typeof LOCALES)[number]['value'];
/** Every key of the Russian catalog; the English catalog is checked against it at build time. */
export type MessageKey = keyof typeof ru;
export type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>;

declare module 'i18next' {
	interface CustomTypeOptions {
		enableSelector: false;
		keySeparator: false;
		resources: { translation: typeof ru };
	}
}
