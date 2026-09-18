import { expect, test, type Locator, type Page } from '@playwright/test';

import {
	chooseScale,
	loadTime,
	resetFilters,
	toggleLegend,
	closeScope,
	settleCamera
} from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const openTime = async (page: Page): Promise<void> => {
	await loadTime(page, { manifest: 'dense' });
	await expect(page.getByTestId('scope-rail-rows').locator('li').first()).toBeVisible();
	await chooseScale(page, 'год');
	await expect
		.poll(async () => page.getByTestId('ribbon-twin').locator('button').count())
		.toBeGreaterThan(3);
};

const twinButtons = (page: Page): Locator => page.getByTestId('ribbon-twin').locator('button');
const current = (page: Page, traceId: string): Locator =>
	page.locator(`[data-testid=ribbon-twin] button[aria-current="true"][data-trace-id="${traceId}"]`);
const title = (page: Page): Locator => page.getByTestId('selected-title');
const dateRange = (page: Page): Locator => page.getByTestId('window-dates');

/** Clicks the canvas at coordinates the twin publishes for one of its entries. */
const clickCanvasAt = async (page: Page, entry: Locator, prefix: 'data' | 'data-label') => {
	const x = Number(await entry.getAttribute(`${prefix}-x`));
	const y = Number(await entry.getAttribute(`${prefix}-y`));
	const box = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	await page.mouse.click(box.x + x, box.y + y);
};

/** Keyboard shortcuts of the window apply once no control holds the focus. */
const blur = (page: Page): Promise<void> =>
	page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

const selectFromTwin = async (page: Page, entry: Locator): Promise<string> => {
	const traceId = (await entry.getAttribute('data-trace-id'))!;
	await entry.focus();
	await entry.press('Enter');
	await settleCamera(page);
	return traceId;
};

test('a click on a mark or on its caption selects the record', async ({ page }) => {
	await openTime(page);
	const entries = twinButtons(page);
	const first = entries.and(page.locator('[data-alone="true"]')).first();
	const firstId = await first.getAttribute('data-trace-id');
	await clickCanvasAt(page, first, 'data');
	await expect(title(page)).toBeVisible();
	await expect(current(page, firstId!)).not.toHaveCount(0);
	const other = entries
		.and(page.locator(`[data-label-x]:not([data-trace-id="${firstId}"])`))
		.first();
	await expect(other).toHaveCount(1);
	const otherId = await other.getAttribute('data-trace-id');
	await clickCanvasAt(page, other, 'data-label');
	await expect(current(page, otherId!)).not.toHaveCount(0);
	await expect(current(page, firstId!)).toHaveCount(0);
	await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
});

test('history walks back and forward through selections', async ({ page }) => {
	await openTime(page);
	const entries = twinButtons(page);
	const firstId = await selectFromTwin(page, entries.first());
	const firstTitle = await title(page).innerText();
	await selectFromTwin(
		page,
		entries.and(page.locator(`:not([data-trace-id="${firstId}"])`)).first()
	);
	const secondTitle = await title(page).innerText();
	expect(secondTitle).not.toBe(firstTitle);
	await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
	await page.getByTestId('history-back').click();
	await expect(title(page)).toHaveText(firstTitle);
	await expect(page.getByTestId('history-position')).toHaveText('1 / 2');
	await page.getByTestId('history-forward').click();
	await expect(title(page)).toHaveText(secondTitle);
	await expect(page.getByTestId('history-forward')).toBeDisabled();
});

test('a selection made off the canvas brings the window to it', async ({ page }) => {
	await openTime(page);
	const entries = twinButtons(page);
	const traceId = await selectFromTwin(
		page,
		entries.and(page.locator('[data-kind="moment"][data-alone="true"]')).first()
	);
	const home = await dateRange(page).innerText();
	await blur(page);
	for (let i = 0; i < 20; i += 1) await page.keyboard.press('ArrowRight');
	await expect(dateRange(page)).not.toHaveText(home);
	await expect(
		page.locator(`[data-testid=ribbon-twin] button[data-trace-id="${traceId}"]`)
	).toHaveCount(0);
	await page.getByTestId('go-to-selected').click();
	await settleCamera(page);
	await expect(current(page, traceId)).not.toHaveCount(0);
	const back = await dateRange(page).innerText();
	await chooseScale(page, 'год');
	await selectFromTwin(
		page,
		twinButtons(page)
			.and(page.locator(`[data-kind="moment"]:not([data-trace-id="${traceId}"])`))
			.first()
	);
	await blur(page);
	for (let i = 0; i < 20; i += 1) await page.keyboard.press('ArrowLeft');
	await expect(dateRange(page)).not.toHaveText(back);
	await page.getByTestId('history-back').click();
	await expect(current(page, traceId)).not.toHaveCount(0);
});

test('legend items filter the ribbon and one button resets them', async ({ page }) => {
	await openTime(page);
	const before = await twinButtons(page).count();
	await toggleLegend(page, 'moment');
	await toggleLegend(page, 'rollup');
	await expect(page.getByTestId('filters-count')).toHaveText('2');
	await expect.poll(async () => twinButtons(page).count()).toBeLessThan(before);
	await resetFilters(page);
	await expect(page.getByTestId('filters-count')).toHaveCount(0);
	await expect.poll(async () => twinButtons(page).count()).toBe(before);
});

test('overview follows the ribbon when Scope is resized or closed', async ({ page }) => {
	await openTime(page);
	const overview = page.getByTestId('overview');
	const ribbon = page.getByTestId('ribbon-canvas');
	const expectAligned = async () => {
		await expect
			.poll(async () => {
				const strip = (await overview.boundingBox())!;
				const canvas = (await ribbon.boundingBox())!;
				return Math.max(Math.abs(strip.x - canvas.x), Math.abs(strip.width - canvas.width));
			})
			.toBeLessThan(1);
	};
	await expectAligned();
	const originalX = (await ribbon.boundingBox())!.x;
	await page.getByRole('separator', { name: 'Ширина Scope' }).press('Shift+ArrowRight');
	await expect.poll(async () => (await ribbon.boundingBox())!.x).toBeGreaterThan(originalX);
	await expectAligned();
	await closeScope(page);
	await expect(page.getByTestId('scope-rail-rows')).toHaveCount(0);
	await expectAligned();
	await page.setViewportSize({ width: 390, height: 844 });
	await expectAligned();
});
