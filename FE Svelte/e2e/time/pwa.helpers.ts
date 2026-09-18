import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * An explicit app update, proved on a served static root the test itself moves from one
 * build to the next. Opt-in: `TEMPIENCE_E2E_PWA_ROOT` (the directory a loopback server
 * serves), `TEMPIENCE_E2E_PWA_FIRST` (the build served first) and `TEMPIENCE_E2E_PWA_NEXT`
 * (a second build, a fresh service-worker stamp). Needs a secure origin (127.0.0.1).
 */
export const PWA = {
	root: process.env.TEMPIENCE_E2E_PWA_ROOT,
	first: process.env.TEMPIENCE_E2E_PWA_FIRST,
	next: process.env.TEMPIENCE_E2E_PWA_NEXT
};

export const pwaConfigured = (): boolean =>
	[PWA.root, PWA.first, PWA.next].every((path) => path && existsSync(path));

/** The served root becomes `build`, file for file. */
export const serve = (build: string): void => {
	for (const entry of readdirSync(PWA.root!))
		rmSync(join(PWA.root!, entry), { recursive: true, force: true });
	cpSync(build, PWA.root!, { recursive: true });
};

export const ready = async (page: Page): Promise<void> => {
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 30_000
	});
};

export const banner = (page: Page) =>
	page.getByRole('complementary', { name: 'Обновление приложения' });

/** The next build is served; this tab asks for updates, sees the banner and applies it. */
export const applyUpdateIn = async (page: Page): Promise<void> => {
	serve(PWA.next!);
	await page.getByRole('button', { name: /^Синхронизация:/ }).click();
	await page.getByRole('button', { name: 'Проверить обновления', exact: true }).click();
	await expect(banner(page)).toBeVisible({ timeout: 30_000 });
	await expect(banner(page)).toContainText('Доступна новая версия');
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
		banner(page).getByRole('button', { name: 'Обновить', exact: true }).click()
	]);
	await ready(page);
	await expect(banner(page)).toHaveCount(0);
};
