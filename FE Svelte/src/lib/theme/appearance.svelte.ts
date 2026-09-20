import type { MessageKey } from '$lib/state/Locale/types';
import { CodedError } from '$lib/model/Errors/CodedError';
import { browser } from '$app/environment';
import { baseline, builtinThemes } from './catalog';
import { defaultAppearance, defaultDevice } from './constants';
import { parseDevice, parseTheme } from './normalize';
import { appearanceStyle, resolveAppearance } from './resolve-appearance';
import { scopeBase } from './scope-colour';
import { themeState } from './theme.svelte';
import type { AppearanceDefaults, DeviceAppearance, Theme } from './types';
import type { AppearanceRepository } from '$lib/state/triplit/appearance-repository';

const CACHE_KEY = 'tempience.appearance.v1';
/** The last failure of the storage, read at display; null while there is none. */
let error = $state.raw<unknown>(null);
let cacheWritable = $state(true);
const readCache = (): {
	device: DeviceAppearance;
	defaults: AppearanceDefaults;
	theme: Theme;
} | null => {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const value = JSON.parse(raw);
		const device = parseDevice(value.device),
			theme = parseTheme(value.theme);
		if (
			value.formatVersion !== 1 ||
			!device ||
			!theme ||
			typeof value.defaults?.themeId !== 'string' ||
			!['dark', 'light', 'system'].includes(value.defaults?.mode)
		)
			throw new CodedError(
				'appearance_unsupported_local',
				'Неподдерживаемые локальные настройки. Для замены используйте сброс устройства.'
			);
		return { device, theme, defaults: value.defaults };
	} catch (cause) {
		cacheWritable = false;
		// The reader's own refusal (an unsupported cache) is the words; anything else is a failed read.
		error =
			cause instanceof CodedError
				? cause
				: new CodedError('appearance_read', String(cause), { cause });
		return null;
	}
};
const cached = readCache();
let device = $state<DeviceAppearance>(cached?.device ?? { ...defaultDevice });
let defaults = $state<AppearanceDefaults>(cached?.defaults ?? { ...defaultAppearance });
let customThemes = $state.raw<Theme[]>([]);
let themesReady = $state(false);
let draftTheme = $state<Theme | null>(null);
let draftDevice = $state<DeviceAppearance | null>(null);
let connection = $state<MessageKey>('theme.connLoading');
let repository = $state.raw<AppearanceRepository | null>(null);
const available = $derived([...builtinThemes, ...customThemes]);
const savedId = $derived(device.themeId ?? defaults.themeId);
const savedTheme = $derived(
	available.find((theme) => theme.id === savedId) ??
		(!themesReady && cached?.theme.id === savedId ? cached.theme : baseline)
);
const currentTheme = $derived(draftTheme ?? savedTheme);
const currentDevice = $derived(draftDevice ?? device);
const syncMode = () => {
	const mode = currentDevice.mode ?? defaults.mode;
	if (themeState.preference !== mode) themeState.setPreference(mode);
};
const fail = (cause: unknown) => {
	error = cause instanceof Error ? cause : new CodedError('appearance_storage', String(cause));
};
const writeCache = () => {
	if (!browser || !cacheWritable) return;
	try {
		localStorage.setItem(
			CACHE_KEY,
			JSON.stringify({ formatVersion: 1, device, defaults, theme: savedTheme })
		);
	} catch (cause) {
		fail(cause);
	}
};
const requireRepository = () => {
	if (!repository)
		throw new CodedError('appearance_loading', 'Хранилище оформления ещё загружается.');
	return repository;
};

export const appearance = {
	get themes() {
		return available;
	},
	get theme() {
		return currentTheme;
	},
	get savedTheme() {
		return savedTheme;
	},
	get device() {
		return currentDevice;
	},
	get savedDevice() {
		return device;
	},
	get defaults() {
		return defaults;
	},
	get error() {
		return error;
	},
	get needsCacheReset() {
		return !cacheWritable;
	},
	get connection() {
		return connection;
	},
	get ready() {
		return repository !== null;
	},
	get missingTheme() {
		return themesReady && !available.some((theme) => theme.id === savedId);
	},
	get style() {
		return appearanceStyle(resolveAppearance(currentTheme, currentDevice, themeState.resolved));
	},
	/**
	 * What the theme of the moment gives a Scope colour (C6): the base lightness of the three
	 * depths, read from its canvas in the resolved mode — the same `--cg-bg-canvas` the style
	 * carries — so a pale custom canvas gets deeper Scope colours than the stock one.
	 */
	get scopeBase() {
		return scopeBase(currentTheme.colors[themeState.resolved].canvas, themeState.resolved);
	},
	preview(theme: Theme, nextDevice: DeviceAppearance) {
		const parsed = parseTheme(theme),
			local = parseDevice(nextDevice);
		if (!parsed || !local) return false;
		draftTheme = parsed;
		draftDevice = local;
		syncMode();
		return true;
	},
	previewDevice(nextDevice: DeviceAppearance) {
		const parsed = parseDevice(nextDevice);
		if (parsed) {
			draftDevice = parsed;
			syncMode();
		}
	},
	cancel() {
		draftTheme = null;
		draftDevice = null;
		syncMode();
	},
	applyDevice(nextDevice: DeviceAppearance) {
		const parsed = parseDevice(nextDevice);
		if (!parsed)
			throw new CodedError('device_settings_invalid', 'Некорректные настройки устройства.');
		device = parsed;
		this.cancel();
		writeCache();
	},
	resetDevice() {
		cacheWritable = true;
		error = null;
		this.applyDevice({ ...defaultDevice });
	},
	async saveCopy(theme: Theme, name: string, local: DeviceAppearance) {
		const saved = await requireRepository().saveCopy(theme, name);
		if (!customThemes.some((item) => item.id === saved.id)) customThemes = [...customThemes, saved];
		this.applyDevice({ ...local, themeId: saved.id });
		return saved;
	},
	async makeDefault(themeId: string, mode: AppearanceDefaults['mode']) {
		await requireRepository().setDefaults({ themeId, mode });
		defaults = { themeId, mode };
		this.applyDevice({ ...device, themeId: null, mode: null });
	},
	async deleteTheme(id: string) {
		await requireRepository().deleteTheme(id);
		customThemes = customThemes.filter((theme) => theme.id !== id);
		if (device.themeId === id) this.applyDevice({ ...device, themeId: null });
		writeCache();
	},
	init() {
		let disposed = false;
		const cleanups: Array<() => void> = [];
		syncMode();
		const onStorage = (event: StorageEvent) => {
			if (event.key !== CACHE_KEY || !event.newValue) return;
			try {
				const next = parseDevice(JSON.parse(event.newValue).device);
				if (next) {
					device = next;
					syncMode();
				}
			} catch (cause) {
				fail(cause);
			}
		};
		window.addEventListener('storage', onStorage);
		void import('$lib/state/triplit/appearance-connection')
			.then(({ openAppearanceConnection }) => {
				if (disposed) return;
				const opened = openAppearanceConnection();
				repository = opened.repository;
				connection = opened.paired ? 'theme.connConnecting' : 'theme.connLocal';
				cleanups.push(() => {
					void opened.client.disconnect();
				});
				cleanups.push(
					opened.repository.subscribeThemes((themes, invalid) => {
						customThemes = themes;
						themesReady = true;
						if (invalid)
							error = new CodedError(
								'themes_unsupported',
								'some stored themes have an unsupported format'
							);
						writeCache();
					}, fail)
				);
				cleanups.push(
					opened.repository.subscribeDefaults((value) => {
						defaults = value ?? { ...defaultAppearance };
						syncMode();
						writeCache();
					}, fail)
				);
				cleanups.push(
					opened.client.onConnectionStatusChange((status) => {
						if (opened.paired)
							connection = status === 'OPEN' ? 'theme.connOnline' : 'theme.connOffline';
					})
				);
				cleanups.push(opened.client.onFailureToSyncWrites(fail));
				const online = () => {
					if (opened.paired) void opened.client.connect();
				};
				window.addEventListener('online', online);
				cleanups.push(() => window.removeEventListener('online', online));
			})
			.catch(fail);
		return () => {
			disposed = true;
			repository = null;
			window.removeEventListener('storage', onStorage);
			for (const cleanup of cleanups.reverse()) cleanup();
			this.cancel();
		};
	}
};
