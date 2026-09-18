import { expect, type Page } from '@playwright/test';

declare global {
	interface Window {
		__boundary?: { calls: Record<string, number>; refuse: Record<string, string> };
		/** The URL the page itself loaded a module by, so an import shares the app's instance. */
		__appModule?: (path: string) => string;
		/** The browser's own resource entries, bound before a fixed clock replaced `performance`. */
		__resourceEntries?: (type: string) => PerformanceEntryList;
	}
}

/**
 * Before the page loads: room for every module the dev server serves in the resource timing
 * buffer, so `appModule` can find the URL the page loaded a module by. A dev server stamps a
 * module it re-served after an edit with `?t=…`; an import by the bare path would then get a
 * second instance — a second repository, a second `CodedError` class — and prove nothing.
 */
export const prepareBoundary = (page: Page): Promise<void> =>
	page.addInitScript(() => {
		performance.setResourceTimingBufferSize(20_000);
		// `loadTime` fixes the clock, and that swaps `performance` for one that records nothing:
		// the real entries stay reachable through the function bound here, before the swap.
		window.__resourceEntries = performance.getEntriesByType.bind(performance);
	});

/**
 * The repository boundary of the app, on its own repository object through the dev server's
 * module URLs: every call counted by method, and a method named in `refuse` answering with a
 * coded refusal of that code instead. A production preview serves no such URL — a spec that
 * asks for this skips there; what it proves is the app's behaviour, not the harness's.
 */
export const instrumentBoundary = (page: Page): Promise<boolean> =>
	page.evaluate(async () => {
		try {
			window.__appModule = (path: string): string => {
				const entries =
					window.__resourceEntries ?? ((type: string) => performance.getEntriesByType(type));
				const loaded = entries('resource')
					.map((entry) => entry.name)
					.find((name) => new URL(name).pathname === path);
				if (!loaded) return path;
				const url = new URL(loaded);
				return url.pathname + url.search;
			};
			const { tempienceRepository } = await import(
				/* @vite-ignore */ window.__appModule('/src/lib/state/triplit/index.ts')
			);
			const { RepositoryError } = await import(
				/* @vite-ignore */ window.__appModule('/src/lib/state/triplit/Repository/errors.ts')
			);
			const boundary = {
				calls: {} as Record<string, number>,
				refuse: {} as Record<string, string>
			};
			window.__boundary = boundary;
			const repository = tempienceRepository as unknown as Record<
				string,
				(...args: unknown[]) => unknown
			>;
			for (const name of Object.keys(repository)) {
				const original = repository[name];
				if (typeof original !== 'function') continue;
				repository[name] = (...args: unknown[]) => {
					boundary.calls[name] = (boundary.calls[name] ?? 0) + 1;
					const code = boundary.refuse[name];
					if (code) return Promise.reject(new RepositoryError(code as never, `${name} refused`));
					return original.apply(tempienceRepository, args);
				};
			}
			return true;
		} catch {
			return false;
		}
	});

export const resetCalls = (page: Page): Promise<void> =>
	page.evaluate(() => {
		window.__boundary!.calls = {};
	});

export const boundaryCalls = (page: Page): Promise<Record<string, number>> =>
	page.evaluate(() => ({ ...window.__boundary!.calls }));

/** From now on `method` refuses with `code`; `false` lets it answer again. */
export const refuse = (page: Page, method: string, code: string | false): Promise<void> =>
	page.evaluate(
		([name, value]) => {
			if (value) window.__boundary!.refuse[name as string] = value as string;
			else delete window.__boundary!.refuse[name as string];
		},
		[method, code] as const
	);

/** A switch, then a settled moment: whatever a switch starts at the boundary has been asked. */
export const switchAndSettle = async (
	page: Page,
	language: 'ru' | 'en'
): Promise<Record<string, number>> => {
	await resetCalls(page);
	await page.getByTestId('locale-picker').selectOption(language);
	await expect(page.locator('html')).toHaveAttribute('lang', language);
	await page.waitForTimeout(1500);
	return boundaryCalls(page);
};
