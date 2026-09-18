import { expect, test } from '@playwright/test';
import { loadTime } from './helpers';
test.use({ viewport: { width: 1225, height: 800 }, isMobile: false, hasTouch: false });

test('identity bar exposes appearance directly and removes legacy and scenario menus', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const header = page.getByTestId('identity-bar');
	expect((await header.boundingBox())!.height).toBe(36);
	await expect(header.getByTestId('data-space-switcher')).toBeVisible();
	await expect(header.getByTestId('scenario-data-space-menu')).toHaveCount(0);
	await expect(header.getByRole('link')).toHaveCount(1);
	await expect(header.getByRole('link', { name: 'Tempience', exact: true })).toHaveAttribute(
		'href',
		'/'
	);
	// The catalog of Kinds opens from the timeline toolbar into the Context (2026-09-15), not from the bar.
	await expect(header.getByTestId('kinds-open')).toHaveCount(0);
	await expect(page.getByTestId('kinds-open').locator('visible=true')).toHaveText('Trace Kind');
	await expect(page.getByTestId('app-menu')).toHaveCount(0);
	const trigger = page.getByTestId('appearance-open');
	await trigger.focus();
	await trigger.press('Enter');
	await expect(page.getByRole('dialog', { name: 'Внешний вид' })).toBeVisible();
	await page.getByRole('button', { name: 'Светлая', exact: true }).click();
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('window readout hosts presets and zoom controls while the toolbar stays compact', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	expect((await page.getByTestId('time-toolbar').boundingBox())!.height).toBe(44);
	expect((await page.getByTestId('overview').boundingBox())!.height).toBe(28);
	await expect(page.getByTestId('window-count')).toContainText('в окне');
	await page.getByTestId('window-readout').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('button', { name: '3 года', exact: true })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('window-span')).toHaveAttribute('data-days', '1095');
	await page.getByRole('button', { name: 'Приблизить', exact: true }).click();
	await expect(page.getByTestId('window-span')).not.toHaveAttribute('data-days', '1095');
	await page.setViewportSize({ width: 1100, height: 800 });
	await expect(page.getByTestId('window-dates')).not.toBeVisible();
	await expect(page.getByTestId('window-span')).toBeVisible();
});

test('Scope search and its row count share one header aligned with the overview and axis', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	// Three rows, in the plural form three takes.
	await expect(page.getByTestId('rows-count')).toHaveText('3 строки');
	const search = (await page.getByRole('searchbox', { name: 'Поиск Scope' }).boundingBox())!;
	const menu = (await page.getByTestId('scope-menu-toggle').boundingBox())!;
	expect(Math.abs(search.y + search.height / 2 - menu.y - menu.height / 2)).toBeLessThan(1);
	const list = (await page.getByTestId('scope-rail-rows').boundingBox())!;
	const canvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	expect(Math.abs(list.y - canvas.y)).toBeLessThan(1);
	await page.getByTestId('scope-menu-toggle').click();
	await expect(page.getByRole('button', { name: 'Структура', exact: true })).toHaveCount(0);
	await page.screenshot({ path: 'test-results/c9a-scope-menu.png' });
});

test('row height lives in the Scope menu and persists; closing Scope has its own button', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await expect(page.getByRole('group', { name: 'Высота строк', exact: true })).not.toBeVisible();
	await page.getByTestId('scope-menu-toggle').click();
	await expect(page.getByRole('group', { name: 'Высота строк', exact: true })).toBeVisible();
	await expect(page.getByTestId('rail-row-height')).toHaveText('52 px');
	await page.getByRole('button', { name: 'Строки выше', exact: true }).click();
	await expect(page.getByTestId('rail-row-height')).toHaveText('76 px');
	await page.reload();
	await page.getByTestId('scope-menu-toggle').click();
	await expect(page.getByTestId('rail-row-height')).toHaveText('76 px');
	await page.getByRole('button', { name: 'Исходная высота строк', exact: true }).click();
	await expect(page.getByTestId('rail-row-height')).toHaveText('52 px');
	await page.keyboard.press('Escape');
	await page.getByTestId('scope-close').click();
	await expect(page.getByRole('button', { name: 'Scope', exact: true })).toBeVisible();
});
