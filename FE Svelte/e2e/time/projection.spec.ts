import { expect, test, type Page } from '@playwright/test';
import { loadTime, resetFilters } from './helpers';

test.use({ viewport: { width: 1225, height: 660 }, isMobile: false, hasTouch: false });

const rows = (page: Page) => page.getByTestId('scope-rail-rows').locator('[data-row-id]');

test('kind visibility comes from the legend and search remains a Scope filter', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const total = await rows(page).count();
	const twin = page.getByTestId('ribbon-twin');
	// The legend sits in the filters: a kind switched off there leaves the ribbon and counts as a filter.
	await page.getByTestId('filters-toggle').click();
	await page.getByTestId('legend').getByRole('button', { name: 'момент', exact: true }).click();
	await page.keyboard.press('Escape');
	await expect(twin.locator('[data-kind="moment"]')).toHaveCount(0);
	await expect(page.getByTestId('filters-count')).toHaveText('1');
	await page.getByTestId('filters-toggle').click();
	await page.getByTestId('legend').getByRole('button', { name: 'момент', exact: true }).click();
	await page.keyboard.press('Escape');
	await expect(twin.locator('[data-kind="moment"]')).not.toHaveCount(0);
	await page.getByRole('searchbox', { name: 'Поиск Scope' }).fill('Фронт');
	await expect(rows(page).last()).toContainText('Фронт');
	await resetFilters(page);
	await expect(rows(page)).toHaveCount(total);
});

test('parked chips share Scope filters and select through the keyboard without moving time', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await expect(page.getByTestId('parked-count')).toHaveText('8');
	const parked = page.getByRole('region', { name: 'Без даты', exact: true });
	const chips = parked.getByTestId('parked-chip');
	const chip = chips.first();
	const window = await page.getByTestId('overview-readout').textContent();
	const label = await chip.locator('span').first().textContent();
	await chip.focus();
	await chip.press('Enter');
	await expect(page.getByTestId('selected-title')).toHaveText(label!);
	await expect(chip).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('overview-readout')).toHaveText(window!);
	await expect(page.getByTestId('go-to-selected')).toBeDisabled();
	await page.getByRole('searchbox', { name: 'Поиск Scope' }).fill('совпадений нет');
	// Without records the «Без даты» row is not drawn at all.
	await expect(parked).toHaveCount(0);
	await resetFilters(page);
	await expect(chips).toHaveCount(8);
	await expect(page.getByTestId('selected-title')).toHaveText(label!);
});
