import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';

/** The designed history of «Замер» (src/lib/state/triplit/TraceDataset/kind-history.backup.test.ts). */
export const HISTORY_BACKUP = new URL('../fixtures/kind-history.backup.json', import.meta.url);

/**
 * Restores the designed history into a database of its own through «Загрузить JSON» — the
 * one user path that seeds a browser database in bulk — and lands on the timeline of it.
 */
export const openHistorySpace = async (page: Page): Promise<void> => {
	await page.addInitScript(() => localStorage.setItem('chronograph-theme', 'dark'));
	await page.goto('/time');
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
	await page.getByRole('button', { name: /Синхронизация:/ }).click();
	await page.getByLabel('JSON-файл с данными').setInputFiles({
		name: 'kind-history.json',
		mimeType: 'application/json',
		buffer: readFileSync(HISTORY_BACKUP)
	});
	await expect(page.getByTestId('backup-import-preview')).toContainText('137 записей');
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
		page.getByRole('button', { name: 'Создать базу из файла', exact: true }).click()
	]);
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
	await expect(page.getByTestId('data-space-switcher')).toHaveValue(/^imported-/);
};

/** The table of one version of the open history, by its generation. */
export const versionTable = (page: Page, generation: number): Locator =>
	page.getByTestId('version-table').filter({
		has: page.getByRole('heading', { name: `Версия ${generation}` })
	});

/** The dated rows of one version's table, in the order shown. */
export const datedRows = (table: Locator): Locator => table.getByTestId('dataset-row');

/** The event date of one row: the first cell, as the table formats it. */
export const dateOf = async (row: Locator): Promise<string> =>
	(await row.getByRole('cell').first().innerText()).trim();

/** The year a formatted date names, for comparisons that do not depend on the locale. */
export const yearOf = (formatted: string): number => Number(/\d{4}/.exec(formatted)?.[0] ?? 0);

/** The catalog opens in the Context from the timeline toolbar (ANSWERS 2026-09-15). */
export const openCatalog = async (page: Page): Promise<Locator> => {
	await page.getByTestId('kinds-open').locator('visible=true').click();
	const catalog = page.getByTestId('trace-forms');
	await expect(catalog).toBeVisible();
	return catalog;
};

/** One Kind chosen in the catalog, its «Данные» put its history in the centre. */
export const openKindHistory = async (page: Page, name: string): Promise<void> => {
	const catalog = await openCatalog(page);
	await catalog.getByRole('button', { name, exact: true }).click();
	await catalog.getByTestId('kind-data').click();
	await expect(page.getByTestId('kind-data-surface')).toBeVisible();
};
