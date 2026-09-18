import { expect, test } from '@playwright/test';
import {
	boundaryCalls,
	instrumentBoundary,
	prepareBoundary,
	refuse,
	resetCalls,
	switchAndSettle
} from './boundary.helpers';
import { editor } from './draft.helpers';
import { loadTime } from './helpers';
import { datedRows, openHistorySpace, openKindHistory } from './kind-history.helpers';
import { closeContext, panel, startCapture } from './results.helpers';

const SKIP = 'The app’s modules are reachable on a dev server only.';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
test.beforeEach(({ page }) => prepareBoundary(page));

/** The first record selected: the read it must cost is the control that the boundary is the app's. */
const selectFirst = async (page: import('@playwright/test').Page): Promise<string> => {
	await resetCalls(page);
	await page.getByTestId('ribbon-twin').getByRole('button').first().dispatchEvent('click');
	await expect(panel(page).getByTestId('selected-title')).toBeVisible();
	await expect(panel(page).getByTestId('context-links')).toBeVisible();
	expect((await boundaryCalls(page)).readTraceRow ?? 0).toBeGreaterThan(0);
	return panel(page).getByTestId('selected-title').innerText();
};

test('a selected record: a switch reads nothing and restarts no feed; its read failure stays and rewords', async ({
	page
}) => {
	test.setTimeout(120_000);
	await loadTime(page, { manifest: 'dense' });
	test.skip(!(await instrumentBoundary(page)), SKIP);
	const title = await selectFirst(page);
	expect(await switchAndSettle(page, 'en')).toEqual({});
	await expect(panel(page).getByTestId('selected-title')).toHaveText(title);
	expect(await switchAndSettle(page, 'ru')).toEqual({});

	// The record's own read refused: the failure is said, and a switch neither reads again nor
	// clears it — it is the same failure in the other words.
	await refuse(page, 'readTraceRow', 'repository_unreadable');
	await page.getByTestId('ribbon-twin').getByRole('button').nth(1).dispatchEvent('click');
	const failure = panel(page).getByTestId('links-error');
	await expect(failure).toContainText('Не удалось прочитать данные.');
	expect(await switchAndSettle(page, 'en')).toEqual({});
	await expect(failure).toContainText('Could not read the data.');
	expect(await switchAndSettle(page, 'ru')).toEqual({});
	await expect(failure).toContainText('Не удалось прочитать данные.');
	await refuse(page, 'readTraceRow', false);
	await panel(page).getByTestId('links-retry').click();
	await expect(failure).toHaveCount(0);
});

test('an open form with unfinished input: a switch reads nothing', async ({ page }) => {
	test.setTimeout(120_000);
	await loadTime(page, { manifest: 'dense' });
	test.skip(!(await instrumentBoundary(page)), SKIP);
	await selectFirst(page);
	await closeContext(page);
	await startCapture(page);
	await editor(page).getByLabel('Название', { exact: true }).fill('Черновик');
	expect(await switchAndSettle(page, 'en')).toEqual({});
	await expect(editor(page).getByLabel('Title', { exact: true })).toHaveValue('Черновик');
	expect(await switchAndSettle(page, 'ru')).toEqual({});
});

test('a Kind history on its second page, then with a Scope filter: a switch reads no page again', async ({
	page
}) => {
	test.setTimeout(120_000);
	await openHistorySpace(page);
	test.skip(!(await instrumentBoundary(page)), SKIP);
	await openKindHistory(page, 'Замер');
	const surface = page.getByTestId('kind-data-surface');
	const v2 = page
		.getByTestId('version-table')
		.filter({ has: page.getByRole('heading', { name: 'Версия 2' }) });
	await resetCalls(page);
	await v2.getByRole('button', { name: 'Следующая', exact: true }).click();
	await expect(v2).toContainText('Страница 2 из 2');
	await expect(datedRows(v2)).toHaveCount(33);
	// The page turned is read: the control that the boundary is the app's.
	expect((await boundaryCalls(page)).readTraceDataset ?? 0).toBeGreaterThan(0);
	const v2en = page
		.getByTestId('version-table')
		.filter({ has: page.getByRole('heading', { name: 'Version 2' }) });
	await page.waitForTimeout(1000);
	expect(await switchAndSettle(page, 'en')).toEqual({});
	await expect(v2en).toContainText('Page 2 of 2');
	await expect(datedRows(v2en)).toHaveCount(33);
	expect(await switchAndSettle(page, 'ru')).toEqual({});
	await expect(datedRows(v2)).toHaveCount(33);
	// A Scope filter applied: the index is asked once for it, a switch asks for nothing.
	await surface.getByText('Фильтры истории').click();
	await surface
		.getByRole('combobox', { name: 'Scope', exact: true })
		.selectOption({ label: 'Здоровье' });
	await expect(surface.getByTestId('history-active')).toContainText('Scope: Здоровье');
	const rows = await datedRows(v2).count();
	await page.waitForTimeout(1000);
	expect(await switchAndSettle(page, 'en')).toEqual({});
	await expect(datedRows(v2en)).toHaveCount(rows);
	await expect(surface.getByTestId('history-active')).toContainText('Scope: Здоровье');
	expect(await switchAndSettle(page, 'ru')).toEqual({});
	await expect(datedRows(v2)).toHaveCount(rows);
});
