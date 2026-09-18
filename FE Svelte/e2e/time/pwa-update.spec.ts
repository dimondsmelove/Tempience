import { expect, test, type Page } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { dialog, editor, title } from './draft.helpers';
import { loadTime } from './helpers';
import { applyUpdateIn, banner, PWA, pwaConfigured, ready, serve } from './pwa.helpers';
import {
	captureIntention,
	openLinks,
	outcome,
	panel,
	selectParked,
	showOverview,
	openSources
} from './results.helpers';

const ARTIFACTS = 'e2e/artifacts';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
test.beforeEach(() => {
	test.skip(!pwaConfigured(), 'needs the served root and two builds');
	serve(PWA.first!);
});

const openResult = async (page: Page) => {
	const tab = panel(page).getByRole('tab', { name: 'Результат' });
	if (await tab.count()) await tab.click();
	return panel(page).getByTestId('intention-result');
};

/** A second tab of the same origin (the same worker), on the app's default space. */
const otherTab = async (page: Page, errors: string[]): Promise<Page> => {
	const other = await page.context().newPage();
	other.on('pageerror', (error) => errors.push(error.message));
	await other.goto('/time');
	await ready(other);
	await other.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
	return other;
};

test('an update applied in one tab leaves the other tab and its form input alone until that tab chooses', async ({
	page
}) => {
	test.setTimeout(180_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => localStorage.setItem('chronograph-theme', 'dark'));
	await page.goto('/time');
	await ready(page);
	await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
	const other = await otherTab(page, errors);
	await other.getByTestId('capture').click();
	await title(other).fill('Черновик во второй вкладке');
	await expect(banner(page)).toHaveCount(0);
	await expect(banner(other)).toHaveCount(0);

	await applyUpdateIn(page);
	await page.screenshot({ path: `${ARTIFACTS}/i7-pwa-update-banner-1440.png` });
	// The other tab was not reloaded for it: its input stands, and it is only told.
	await expect(title(other)).toHaveValue('Черновик во второй вкладке');
	await expect(editor(other)).toBeVisible();
	await expect(banner(other)).toBeVisible({ timeout: 30_000 });
	await other.screenshot({ path: `${ARTIFACTS}/i7-pwa-update-other-tab-1440.png` });
	// Choosing the update there asks about the input first; keeping it keeps the tab as it is.
	await banner(other).getByRole('button', { name: 'Обновить', exact: true }).click();
	await expect(dialog(other)).toBeVisible();
	await dialog(other).getByTestId('discard-keep').click();
	await expect(title(other)).toHaveValue('Черновик во второй вкладке');
	await expect(banner(other)).toBeVisible();
	// Discarding lets the update through: the tab reloads on the new build.
	await banner(other).getByRole('button', { name: 'Обновить', exact: true }).click();
	await Promise.all([
		other.waitForEvent('framenavigated', { predicate: (frame) => frame === other.mainFrame() }),
		dialog(other).getByTestId('discard-confirm').click()
	]);
	await ready(other);
	await expect(banner(other)).toHaveCount(0);
	await expect(editor(other)).toHaveCount(0);

	// The new build is what the cache holds: offline, the app opens from it.
	await page.context().setOffline(true);
	await page.reload();
	await ready(page);
	await expect(page.getByTestId('appearance-open')).toBeVisible();
	await page.context().setOffline(false);
	expect(errors).toEqual([]);
});

test('an unsent direct assessment and a prepared address correction survive another tab’s update; their own update asks, keeps, writes nothing', async ({
	page
}) => {
	test.setTimeout(180_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await loadTime(page, { manifest: null });
	await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
	// An intention with a stated fact, so a correction of the statement's address exists.
	await captureIntention(page, 'План У');
	await captureIntention(page, 'План Ф');
	await selectParked(page, /План У/);
	await showOverview(page);
	await panel(page).getByTestId('add-result').click();
	await title(page).fill('Факт У');
	await outcome(page, 'План У').selectOption('completed');
	await editor(page).getByTestId('capture-save').click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Факт У');
	const links = await openLinks(page);
	await links.getByTestId('link-target').filter({ hasText: 'План У' }).click();
	await showOverview(page);
	await expect(panel(page).getByTestId('selected-title')).toHaveText('План У');
	const stored = await exportBackup(page);
	// Held in memory only: an unsent «open» decision and a correction typed but not chosen.
	const result = await openResult(page);
	await result.getByTestId('result-assess').click();
	await result.getByTestId('direct-close').check();
	await openSources(result);
	await result.getByTestId('source-retarget').click();
	await result.getByTestId('retarget-search').fill('План Ф');
	await expect(result.getByTestId('retarget-candidate')).toHaveCount(1);
	const other = await otherTab(page, errors);

	await applyUpdateIn(other);
	// This tab was not reloaded for it: both inputs stand, and it is only told.
	await expect(result.getByTestId('direct-close')).toBeChecked();
	await expect(result.getByTestId('retarget-search')).toHaveValue('План Ф');
	await expect(banner(page)).toBeVisible({ timeout: 30_000 });
	await page.screenshot({ path: `${ARTIFACTS}/i7-pwa-update-result-input-1440.png` });
	// Its own update asks first; keeping leaves both inputs, and nothing was written for it.
	await banner(page).getByRole('button', { name: 'Обновить', exact: true }).click();
	await expect(dialog(page)).toBeVisible();
	await dialog(page).getByTestId('discard-keep').click();
	await expect(dialog(page)).toHaveCount(0);
	await expect(result.getByTestId('direct-close')).toBeChecked();
	await expect(result.getByTestId('retarget-search')).toHaveValue('План Ф');
	await expect(banner(page)).toBeVisible();
	expect((await exportBackup(page)).collections).toEqual(stored.collections);
	// Discarding lets the update through: the tab reloads on the new build, nothing written.
	await banner(page).getByRole('button', { name: 'Обновить', exact: true }).click();
	await expect(dialog(page)).toBeVisible();
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
		dialog(page).getByTestId('discard-confirm').click()
	]);
	await ready(page);
	await expect(banner(page)).toHaveCount(0);
	expect((await exportBackup(page)).collections).toEqual(stored.collections);
	expect(errors).toEqual([]);
});
