import { expect, test, type Locator, type Page } from '@playwright/test';
import { loadTime } from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const context = (page: Page) => page.getByRole('complementary', { name: 'Context' });
const title = (page: Page): Locator => context(page).getByTestId('selected-title');
const position = (page: Page): Locator => page.getByTestId('history-position');
const dateRange = (page: Page): Locator => page.getByTestId('window-dates');
/** The DOM twin is the keyboard path onto the ribbon; a dispatched click leaves the focus on the body. */
const pickRecord = async (page: Page, index = 3): Promise<string> => {
	await page.getByTestId('ribbon-twin').getByRole('button').nth(index).dispatchEvent('click');
	await expect(title(page)).not.toBeEmpty();
	return title(page).innerText();
};
/** Keyboard shortcuts of the window apply once no control holds the focus. */
const blur = (page: Page): Promise<void> =>
	page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
/**
 * A point on the ribbon with nothing under it: the initial window keeps 40 days of
 * future on the right, and the dense corpus ends the day before «сейчас».
 */
const emptyPoint = async (page: Page): Promise<[number, number]> => {
	const box = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	return [box.x + box.width - 24, box.y + 26];
};

test('Esc puts the selection to rest and «→» brings the last record back', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	const first = await pickRecord(page, 2);
	const second = await pickRecord(page, 5);
	expect(second).not.toBe(first);
	await expect(position(page)).toHaveText('2 / 2');
	await expect(page.getByTestId('context-rest')).toBeVisible();
	await blur(page);
	await page.keyboard.press('Escape');
	await expect(title(page)).toHaveCount(0);
	await expect(position(page)).toHaveText('— / 2');
	await expect(page.getByTestId('context-rest')).toHaveCount(0);
	await expect(page.getByTestId('history-back')).toBeDisabled();
	await expect(page.getByTestId('history-forward')).toBeEnabled();
	await expect(page.getByTestId('go-to-selected')).toBeDisabled();
	await page.getByTestId('history-forward').click();
	await expect(title(page)).toHaveText(second);
	await expect(position(page)).toHaveText('2 / 2');
	await page.getByTestId('history-back').click();
	await expect(title(page)).toHaveText(first);
});

test('Esc closes «Записать» first and leaves the selection in place', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	const name = await pickRecord(page);
	await page.getByTestId('capture').click();
	await expect(context(page).getByTestId('context-capture')).toBeVisible();
	await blur(page);
	await page.keyboard.press('Escape');
	await expect(context(page).getByTestId('context-capture')).toHaveCount(0);
	await expect(title(page)).toHaveText(name);
	await page.keyboard.press('Escape');
	await expect(title(page)).toHaveCount(0);
	await expect(position(page)).toHaveText('— / 1');
});

test('empty canvas closes Context and keeps selection; dragging keeps Context open', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const name = await pickRecord(page);
	const [x, y] = await emptyPoint(page);
	const home = await dateRange(page).innerText();
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x - 160, y, { steps: 12 });
	await page.mouse.up();
	await expect(dateRange(page)).not.toHaveText(home);
	await expect(title(page)).toHaveText(name);
	await expect(position(page)).toHaveText('1 / 1');
	await page.getByTestId('go-to-selected').click();
	const [x2, y2] = await emptyPoint(page);
	await page.mouse.click(x2, y2);
	await expect(context(page)).toHaveCount(0);
	await expect(page.getByTestId('ribbon-twin').locator('[aria-current="true"]')).not.toHaveCount(0);
	await page.getByRole('button', { name: 'Context', exact: true }).click();
	await expect(title(page)).toHaveText(name);
	await expect(position(page)).toHaveText('1 / 1');
});

test('at rest the neutral placeholder keeps capture available without the deferred Now overview', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const placeholder = context(page).getByText('Выбери запись или период', { exact: true });
	await expect(placeholder).toBeVisible();
	await expect(page.getByTestId('context-now')).toHaveCount(0);
	await expect(context(page).getByText('Свершилось', { exact: true })).toHaveCount(0);
	await expect(context(page).getByText('Намечено', { exact: true })).toHaveCount(0);
	await page.getByTestId('capture').click();
	await expect(context(page).getByTestId('context-capture')).toBeVisible();
	await blur(page);
	await page.keyboard.press('Escape');
	await expect(placeholder).toBeVisible();
});

test('the «Снять выбор» button in the header rests the selection', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	await pickRecord(page);
	await page.getByTestId('context-rest').click();
	await expect(title(page)).toHaveCount(0);
	await expect(position(page)).toHaveText('— / 1');
	await expect(page.getByTestId('context-rest')).toHaveCount(0);
	await page.getByTestId('context-collapse').click();
	await expect(context(page)).toHaveCount(0);
	await page.getByRole('button', { name: 'Context', exact: true }).click();
	await expect(context(page)).toBeVisible();
});
