import type { TOptions } from 'i18next';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from './constants';
import { isLocale, translate } from './messages';
import type { Locale, LocaleStorage, MessageKey } from './types';

export { hasMessage, isLocale, translate } from './messages';

/** Russian browsers stay Russian; every other preference reads the English interface. */
export const detectLocale = (languages: readonly string[] | undefined): Locale => {
	const primary = languages?.[0]?.trim().toLowerCase();
	if (!primary) return DEFAULT_LOCALE;
	return primary === 'ru' || primary.startsWith('ru-') ? 'ru' : 'en';
};

/**
 * The interface language of this browser: an explicit choice restored from local storage,
 * otherwise the browser's own language; switchable for the session even when storage is
 * denied, mirrored into `document.lang`. Only `set` persists, so a browser whose language
 * changes follows along until the user picks a language by hand. It never touches data
 * spaces, drafts, stored values or user-entered names; templates that read `t(...)`
 * re-render through `current`.
 */
export class LocaleState {
	current = $state<Locale>(DEFAULT_LOCALE);
	private storage: LocaleStorage | undefined;

	init(storage?: LocaleStorage, languages?: readonly string[]): void {
		let saved: string | null = null;
		try {
			this.storage = storage ?? localStorage;
			saved = this.storage.getItem(LOCALE_STORAGE_KEY);
		} catch {
			// Language switching still works when the browser denies access to local storage.
		}
		this.current = isLocale(saved) ? saved : detectLocale(languages);
		this.syncDocument();
	}

	set(next: string): void {
		if (!isLocale(next)) return;
		this.current = next;
		try {
			this.storage?.setItem(LOCALE_STORAGE_KEY, next);
		} catch {
			// The selected language remains active for this session.
		}
		this.syncDocument();
	}

	t(key: MessageKey, options?: TOptions): string {
		return translate(this.current, key, options);
	}

	private syncDocument(): void {
		if (typeof document !== 'undefined') document.documentElement.lang = this.current;
	}
}

// Tempience disables SSR; the locale belongs to this browser session, like the workbench.
export const locale = new LocaleState();
export const t = (key: MessageKey, options?: TOptions): string => locale.t(key, options);
