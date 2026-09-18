import { browser } from '$app/environment';
import {
	resolveTheme,
	themeAttributeValue,
	type ResolvedTheme,
	type ThemePreference
} from './resolve-theme';

const STORAGE_KEY = 'chronograph-theme';
const LEGACY_STORAGE_KEY = 'THEME_PREFERENCE_KEY';

const readStored = (): ThemePreference => {
	if (!browser) return 'dark';
	const value = localStorage.getItem(STORAGE_KEY);
	if (value === 'light' || value === 'dark' || value === 'system') return value;

	const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (legacy === 'light' || legacy === 'dark') {
		localStorage.setItem(STORAGE_KEY, legacy);
		localStorage.removeItem(LEGACY_STORAGE_KEY);
		return legacy;
	}

	return 'dark';
};

let preference = $state<ThemePreference>(readStored());
let systemPrefersDark = $state(true);

const applyDomTheme = (pref: ThemePreference): void => {
	if (!browser) return;

	const resolved = resolveTheme(pref, systemPrefersDark);
	const attr = themeAttributeValue(pref);

	if (attr === null) {
		document.documentElement.removeAttribute('data-theme');
	} else {
		document.documentElement.setAttribute('data-theme', attr);
	}

	document.documentElement.classList.toggle('dark', resolved === 'dark');
};

export const themeState = {
	get preference(): ThemePreference {
		return preference;
	},
	get resolved(): ResolvedTheme {
		return resolveTheme(preference, systemPrefersDark);
	},
	setPreference(next: ThemePreference): void {
		preference = next;
		if (!browser) return;
		localStorage.setItem(STORAGE_KEY, next);
		applyDomTheme(next);
	},
	toggleResolved(): void {
		this.setPreference(this.resolved === 'dark' ? 'light' : 'dark');
	},
	init(): (() => void) | void {
		if (!browser) return;

		systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		applyDomTheme(preference);

		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = (event: MediaQueryListEvent): void => {
			systemPrefersDark = event.matches;
			if (preference === 'system') applyDomTheme('system');
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	},
	sync(): void {
		applyDomTheme(preference);
	}
};
