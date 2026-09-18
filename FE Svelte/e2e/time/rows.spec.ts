import { expect, test, type Locator, type Page } from '@playwright/test';
import { loadTime, settleCamera } from './helpers';
import { openEditor } from '../appearance.helpers';

test.use({ viewport: { width: 1225, height: 800 }, isMobile: false, hasTouch: false });

const rows = (page: Page): Locator => page.getByTestId('scope-rail-rows').locator('[data-row-id]');
const rowHeight = async (page: Page): Promise<number> =>
	(await rows(page).first().boundingBox())!.height;
const openSizing = async (page: Page) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Это устройство', exact: true }).click();
};

test('manual height and disclosure survive viewport and panel resizing; the device remembers height', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await expect(rows(page)).toHaveCount(3);
	await page.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true }).click();
	const count = await rows(page).count();
	await openSizing(page);
	await page.getByRole('button', { name: 'Увеличить высоту строк' }).click();
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect.poll(() => rowHeight(page)).toBe(76);
	const canvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	const first = (await rows(page).first().boundingBox())!;
	expect(Math.abs(canvas.y - first.y)).toBeLessThan(1);
	expect(canvas.height).toBe(count * 76);
	for (const size of [
		{ width: 1180, height: 600 },
		{ width: 1920, height: 1080 }
	]) {
		await page.setViewportSize(size);
		await expect.poll(() => rowHeight(page)).toBe(76);
		await expect(rows(page)).toHaveCount(count);
	}
	await page.getByRole('separator', { name: 'Ширина Scope' }).press('Shift+ArrowRight');
	await expect.poll(() => rowHeight(page)).toBe(76);
	await expect(rows(page)).toHaveCount(count);
	await page.reload();
	await expect.poll(() => rowHeight(page)).toBe(76);
	await openSizing(page);
	await page.getByRole('button', { name: 'Сбросить высоту' }).click();
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect.poll(() => rowHeight(page)).toBe(52);
});

test('height bounds and independent text scale preserve selection, hit coordinates and the time window', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const target = page.getByTestId('ribbon-twin').getByRole('button').first();
	await target.focus();
	await target.press('Enter');
	await settleCamera(page);
	const title = await page.getByTestId('selected-title').textContent();
	const window = await page.getByTestId('overview-readout').textContent();
	await openSizing(page);
	const minus = page.getByRole('button', { name: 'Уменьшить высоту строк' });
	await expect(minus).toBeDisabled();
	await expect(page.getByTestId('row-height')).toHaveText('52 px');
	await page.getByLabel('Масштаб текста', { exact: false }).fill('1.5');
	await expect(page.getByTestId('row-height')).toHaveText('52 px');
	const plus = page.getByRole('button', { name: 'Увеличить высоту строк' });
	for (let i = 0; i < 48; i++) await plus.click();
	await expect(plus).toBeDisabled();
	await expect(page.getByTestId('row-height')).toHaveText('1200 px');
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect.poll(() => rowHeight(page)).toBe(1200);
	await expect(page.getByTestId('selected-title')).toHaveText(title!);
	await expect(page.getByTestId('overview-readout')).toHaveText(window!);
	await page.screenshot({ path: 'test-results/c9a-height-max.png' });
});

test('«Без даты» is the last row: counted, wrapped, foldable, and its chips select', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const row = page.getByTestId('parked-row');
	const chips = row.getByTestId('parked-chip');
	await expect(page.getByTestId('parked-count')).toHaveText('8');
	await expect(chips).toHaveCount(8);
	const last = (await rows(page).last().boundingBox())!;
	const box = (await row.boundingBox())!;
	expect(Math.abs(box.y - last.y - last.height)).toBeLessThan(1);
	expect(box.height).toBeGreaterThanOrEqual(52);
	// Chips wrap instead of scrolling sideways or being cut to one line.
	expect((await chips.last().boundingBox())!.y).toBeGreaterThan(
		(await chips.first().boundingBox())!.y
	);
	expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
		true
	);
	const canvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
	const label = await chips.first().locator('span').first().textContent();
	await chips.first().click();
	await expect(page.getByTestId('selected-title')).toHaveText(label!);
	await page.getByTestId('parked-toggle').click();
	await expect(chips).toHaveCount(0);
	await expect(page.getByTestId('parked-count')).toHaveText('8');
	expect(await page.evaluate(() => localStorage.getItem('tempience.parked.open.v1'))).toBe('false');
	await expect.poll(async () => (await row.boundingBox())!.height).toBeLessThan(box.height);
	await page.getByTestId('parked-toggle').click();
	await expect(chips).toHaveCount(8);
});
