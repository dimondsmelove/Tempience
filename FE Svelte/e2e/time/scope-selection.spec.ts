import { expect, test } from '@playwright/test';
import { chooseScale, loadTime } from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('Scope name selects without disclosure; Context navigates children, records and history', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const work = page.getByRole('button', { name: 'Выбрать Scope Работа', exact: true });
	const rows = page.getByTestId('scope-rail-rows').locator('li');
	const count = await rows.count();
	await work.click();
	await expect(page.getByTestId('selected-title')).toHaveText('Работа');
	await expect(page.getByTestId('context-scope')).toBeVisible();
	await expect(work).toHaveAttribute('aria-pressed', 'true');
	await expect(rows).toHaveCount(count);
	await page
		.getByTestId('context-scope')
		.getByRole('button', { name: 'Tempience', exact: true })
		.click();
	await expect(page.getByTestId('selected-title')).toHaveText('Tempience');
	await page.getByTestId('scope-record').first().click();
	await expect(page.getByTestId('context-scope')).toHaveCount(0);
	await expect(page.getByTestId('belongings')).toBeVisible();
	await page.getByTestId('history-back').click();
	await expect(page.getByTestId('selected-title')).toHaveText('Tempience');
	await page.getByTestId('history-back').click();
	await expect(page.getByTestId('selected-title')).toHaveText('Работа');
	await page.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true }).click();
	await expect.poll(() => rows.count()).toBeGreaterThan(count);
	await expect(page.getByTestId('selected-title')).toHaveText('Работа');
});

test('selecting an actual canvas mark reopens a manually closed Context', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	await chooseScale(page, 'год');
	await page.getByRole('button', { name: 'Закрыть Context', exact: true }).click();
	await expect(page.getByTestId('context-body')).not.toBeVisible();
	const entry = page.getByTestId('ribbon-twin').locator('button[data-alone="true"]').first();
	const x = Number(await entry.getAttribute('data-x'));
	const y = Number(await entry.getAttribute('data-y'));
	const box = (await page.getByTestId('ribbon-canvas').boundingBox())!;
	await page.mouse.click(box.x + x, box.y + y);
	await expect(page.getByTestId('selected-title')).toBeVisible();
	await expect(page.getByTestId('context-body')).toBeVisible();
});
