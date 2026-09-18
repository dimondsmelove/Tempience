import { expect, test, type Page } from '@playwright/test';
import { trackConsoleErrors } from './helpers';
import { exportBackup } from './public/helpers';

test.skip(process.env.PUBLIC_BUILD === '1', 'Requires the owner build.');
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const ready = async (page: Page): Promise<void> => {
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	await expect(page.getByTestId('ribbon-canvas')).toBeVisible();
};

const switchSpace = async (page: Page, id: string): Promise<void> => {
	await Promise.all([
		page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
		page.getByTestId('data-space-switcher').selectOption(id)
	]);
	await ready(page);
	await expect(page.getByTestId('data-space-switcher')).toHaveValue(id);
};

test('the new root opens Belgrade, preserves it on reload and keeps personal data separate', async ({
	page
}) => {
	const errors = trackConsoleErrors(page);
	await page.goto('/');
	await ready(page);
	const personal = await exportBackup(page);
	expect(
		Object.values(personal.collections).every((rows) => Array.isArray(rows) && rows.length === 0)
	).toBe(true);
	await switchSpace(page, 'belgrade-what-if-v1');
	await expect(page).toHaveURL(/\/$/);
	const belgrade = await exportBackup(page);
	expect(belgrade.collections.traces).toHaveLength(177);
	expect(belgrade.collections.scopes).toHaveLength(38);
	await page.reload();
	await ready(page);
	expect((await exportBackup(page)).collections).toEqual(belgrade.collections);
	await switchSpace(page, 'canonical');
	expect((await exportBackup(page)).collections).toEqual(personal.collections);
	expect(errors).toEqual([]);
});

test('old Time bookmarks redirect to the root and preserve the query and selected database', async ({
	page
}) => {
	const errors = trackConsoleErrors(page);
	await page.addInitScript(() =>
		localStorage.setItem('tempience.data-space.active', 'belgrade-what-if-v1')
	);
	await page.goto('/time?from=bookmark');
	await expect(page).toHaveURL(/\/\?from=bookmark$/);
	await ready(page);
	await expect(page.getByTestId('data-space-switcher')).toHaveValue('belgrade-what-if-v1');
	await expect(page.getByTestId('identity-bar')).toHaveCount(1);
	const data = await exportBackup(page);
	expect(data.collections.traces).toHaveLength(177);
	// Existing non-Time routes remain reachable through the shared shell.
	await page.goto('/forms');
	await expect(page.getByTestId('trace-forms')).toBeVisible();
	await page.getByRole('link', { name: 'Tempience', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	await ready(page);
	expect((await exportBackup(page)).collections).toEqual(data.collections);
	expect(errors).toEqual([]);
});
