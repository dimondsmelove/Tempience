import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import {
	defaultLifePeriod,
	parseLifePeriod,
	parseLifeScale,
	parseLifeScopeIncludeFuture,
	type LifePeriod,
	type LifeScale
} from './navigation';
import { parseLifeScopeFocus, type LifeScopeFocus } from './scope-focus';

const STORAGE_KEY = 'chronograph-life-view';

export type LifeViewState = {
	period: LifePeriod;
	scale: LifeScale;
	scope: LifeScopeFocus | null;
	scopeIncludeFuture: boolean;
};

const defaults = (): LifeViewState => ({
	period: defaultLifePeriod(new Date().toISOString().slice(0, 10)),
	scale: 'week',
	scope: null,
	scopeIncludeFuture: false
});

const readStored = (): LifeViewState | null => {
	if (!browser) return null;
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<LifeViewState>;
		const base = defaults();
		return {
			period: parsed.period ?? base.period,
			scale: parsed.scale ?? base.scale,
			scope: parsed.scope ?? null,
			scopeIncludeFuture: parsed.scopeIncludeFuture ?? false
		};
	} catch {
		return null;
	}
};

const writeStored = (state: LifeViewState): void => {
	if (!browser) return;
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const lifeView = $state<LifeViewState>(readStored() ?? defaults());

const apply = (next: LifeViewState): void => {
	Object.assign(lifeView, next);
	writeStored(lifeView);
};

export const hasLifeUrlParams = (params: URLSearchParams): boolean =>
	params.has('from') ||
	params.has('to') ||
	params.has('scale') ||
	params.has('scope_id') ||
	params.has('scope_uid') ||
	params.has('scope_future');

export const lifeViewFromUrl = (
	params: URLSearchParams,
	fallbackPeriod: LifePeriod
): Partial<LifeViewState> => {
	if (!hasLifeUrlParams(params)) return {};
	const next: Partial<LifeViewState> = {
		period: parseLifePeriod(params, fallbackPeriod),
		scale: parseLifeScale(params.get('scale')),
		scopeIncludeFuture: parseLifeScopeIncludeFuture(params)
	};
	const scopeFocus = parseLifeScopeFocus(params);
	if (scopeFocus) next.scope = scopeFocus;
	return next;
};

export const lifeViewState = {
	get period(): LifePeriod {
		return lifeView.period;
	},
	get scale(): LifeScale {
		return lifeView.scale;
	},
	get scope(): LifeScopeFocus | null {
		return lifeView.scope;
	},
	get scopeIncludeFuture(): boolean {
		return lifeView.scopeIncludeFuture;
	},
	patch(input: Partial<LifeViewState>): void {
		apply({ ...lifeView, ...input });
	},
	hydrateFromUrl(params: URLSearchParams, fallbackPeriod: LifePeriod): void {
		const fromUrl = lifeViewFromUrl(params, fallbackPeriod);
		if (Object.keys(fromUrl).length === 0) return;
		apply({ ...lifeView, ...fromUrl });
	},
	stripUrl(): void {
		if (!browser) return;
		if (window.location.pathname !== resolve('/life')) return;
		if (!window.location.search) return;
		void goto(resolve('/life'), { replaceState: true, keepFocus: true, noScroll: true });
	}
};

export type LifeViewPatch = {
	period?: LifePeriod;
	scale?: LifeScale;
	scope?: LifeScopeFocus | null;
	scopeIncludeFuture?: boolean;
};

export const updateLifeView = (input: LifeViewPatch): void => {
	lifeViewState.patch(input);
};
