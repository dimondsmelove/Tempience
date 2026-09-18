import { expect, test, type Page } from '@playwright/test';

import { openEditor } from './appearance.helpers';
import { closeScope, loadTime } from './time/helpers';

test.use({ viewport: { width: 1225, height: 800 }, isMobile: false, hasTouch: false });

async function radius(page: Page, value: number) {
	await page.getByText('Отступы, скругления и тени', { exact: true }).click();
	const slider = page.getByLabel('Скругление контролов');
	await slider.focus();
	await slider.press('Home');
	for (let i = 0; i < value; i++) await slider.press('ArrowRight');
}
const capture = (page: Page) => page.getByRole('button', { name: 'Записать', exact: true });

test('preview, cancel, copy, reload and panel resizing preserve the time window', async ({
	page
}, testInfo) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await loadTime(page, { manifest: null });
	await expect(capture(page)).toBeVisible();
	await expect(capture(page)).toHaveCSS('border-radius', '3px');
	const dates = await page.getByTestId('window-dates').innerText();
	await page.screenshot({ path: testInfo.outputPath('baseline.png') });
	await openEditor(page);
	await expect(page.getByLabel('Тема', { exact: true }).locator('option')).toHaveCount(43);
	await page.getByLabel('Тема', { exact: true }).selectOption('preset:claude');
	await radius(page, 12);
	await expect(capture(page)).toHaveCSS('border-radius', '12px');
	await page.getByRole('button', { name: 'Сбросить изменения темы', exact: true }).click();
	await expect(capture(page)).not.toHaveCSS('border-radius', '12px');

	await page.getByRole('button', { name: 'Отмена', exact: true }).click();
	await expect(capture(page)).toHaveCSS('border-radius', '3px');
	await openEditor(page);
	await page.getByLabel('Тема', { exact: true }).selectOption('preset:claude');
	await radius(page, 12);
	await page.getByLabel('Название новой темы').fill('Мой Claude');
	await page.getByRole('button', { name: 'Сохранить новую тему', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Внешний вид' }).getByRole('status')).toContainText(
		'Новая тема сохранена'
	);
	await expect(page.getByLabel('Тема', { exact: true }).locator('option')).toHaveCount(44);
	await page.screenshot({ path: testInfo.outputPath('editor.png') });
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(page.getByTestId('window-dates')).toHaveText(dates);
	await page.reload();
	await expect(capture(page)).toHaveCSS('border-radius', '12px');
	await openEditor(page);
	await expect(page.getByLabel('Тема', { exact: true }).locator('option:checked')).toHaveText(
		'Мой Claude'
	);
	await page.getByRole('button', { name: 'Отмена', exact: true }).click();
	const splitter = page.getByRole('separator', { name: 'Ширина Scope', exact: true });
	const before = Number(await splitter.getAttribute('aria-valuenow'));
	await splitter.focus();
	await splitter.press('ArrowRight');
	await expect(splitter).toHaveAttribute('aria-valuenow', String(before + 8));
	const box = (await splitter.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + 80);
	await page.mouse.down();
	await page.mouse.move(box.x + 44, box.y + 80);
	await page.mouse.up();
	const resized = Number(await splitter.getAttribute('aria-valuenow'));
	expect(resized).toBeGreaterThan(before + 8);
	await page.reload();
	await expect(splitter).toHaveAttribute('aria-valuenow', String(resized));
	await page.screenshot({ path: testInfo.outputPath('custom.png') });
	expect(errors).toEqual([]);
});

test('large typography updates canvas metrics and stays usable on a phone', async ({
	page
}, testInfo) => {
	await loadTime(page, { manifest: null });
	await openEditor(page);
	await page.getByRole('button', { name: 'Это устройство', exact: true }).click();
	const scale = page.getByLabel(/Масштаб текста:/);
	await scale.focus();
	await scale.press('End');
	await expect(page.getByLabel('Ось времени: клик по подписи выбирает период')).toHaveCSS(
		'height',
		'66px'
	);
	await page.getByRole('button', { name: 'Применить', exact: true }).click();

	const dates = await page.getByTestId('window-dates').innerText();
	// This click is below the old 44px canvas hit area, in the scaled minor row.
	const axis = (await page
		.getByLabel('Ось времени: клик по подписи выбирает период')
		.boundingBox())!;
	await page.mouse.click(axis.x + 100, axis.y + 54);
	await expect(
		page.getByRole('complementary', { name: 'Context', exact: true }).locator('h2')
	).toBeVisible();
	await expect(page.getByTestId('window-dates')).toHaveText(dates);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.getByRole('button', { name: 'Scope', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Scope', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Scope', exact: true })).toBeVisible();
	await closeScope(page);
	await page.getByRole('group', { name: 'Подписи оси' }).getByRole('button').first().press('Enter');
	await expect(page.getByRole('region', { name: 'Context', exact: true })).toBeVisible();
	await page.getByTestId('context-collapse').click();
	await openEditor(page);
	await expect(page.getByRole('button', { name: 'Отмена', exact: true })).toBeInViewport();
	await page.screenshot({ path: testInfo.outputPath('mobile-large-text.png') });
	await page.getByRole('button', { name: 'Отмена', exact: true }).click();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('paired devices share themes, keep independent sizing, and sync after reconnect', async ({
	browser,
	request
}, testInfo) => {
	const desktop = await browser.newContext({ viewport: { width: 1225, height: 760 } });
	const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
	for (const [context, label] of [
		[desktop, 'desktop'],
		[phone, 'phone']
	] as const) {
		const response = await request.post('http://127.0.0.1:6545/pair', {
			data: { code: 'appearance-test', deviceId: crypto.randomUUID(), deviceLabel: label }
		});
		expect(response.ok()).toBe(true);
		const auth = await response.json();
		await context.addInitScript(
			(value) => localStorage.setItem('tempience.triplit.auth', JSON.stringify(value)),
			auth
		);
	}
	const pc = await desktop.newPage(),
		mobile = await phone.newPage();
	await pc.goto('/time');
	await mobile.goto('/time');
	await openEditor(pc);
	await openEditor(mobile);
	await pc.getByLabel('Тема', { exact: true }).selectOption('preset:claude');
	await pc.getByLabel('Название новой темы').fill('Общая тестовая тема');
	await pc.getByRole('button', { name: 'Сохранить новую тему', exact: true }).click();
	await expect(
		mobile.getByLabel('Тема', { exact: true }).locator('option', { hasText: 'Общая тестовая тема' })
	).toHaveCount(1);
	await pc.getByRole('button', { name: 'Сделать выбранную тему общей', exact: true }).click();
	await mobile.getByRole('button', { name: 'Отмена', exact: true }).click();
	await openEditor(mobile);
	await expect(mobile.getByLabel('Тема', { exact: true }).locator('option:checked')).toHaveText(
		'Общая тестовая тема'
	);
	await mobile.getByRole('button', { name: 'Это устройство', exact: true }).click();
	await mobile.getByLabel(/Масштаб текста:/).focus();
	await mobile.getByLabel(/Масштаб текста:/).press('End');
	await mobile.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(mobile.getByLabel('Ось времени: клик по подписи выбирает период')).toHaveCSS(
		'height',
		'66px'
	);
	await expect(pc.getByLabel('Ось времени: клик по подписи выбирает период')).toHaveCSS(
		'height',
		'44px'
	);
	await desktop.setOffline(true);
	await pc.getByLabel('Название новой темы').fill('Создана оффлайн');
	await pc.getByRole('button', { name: 'Сохранить новую тему', exact: true }).click();
	await expect(pc.getByRole('dialog', { name: 'Внешний вид' }).getByRole('status')).toContainText(
		'Новая тема сохранена'
	);
	await desktop.setOffline(false);
	await openEditor(mobile);
	await expect(
		mobile.getByLabel('Тема', { exact: true }).locator('option', { hasText: 'Создана оффлайн' })
	).toHaveCount(1);
	await mobile.getByRole('button', { name: 'Отмена', exact: true }).click();
	// Switching the domain DataSpace must leave the appearance database and device preferences intact.
	await mobile.evaluate(() =>
		localStorage.setItem('tempience.data-space.active', 'belgrade-what-if-v1')
	);
	await mobile.reload();
	await openEditor(mobile);
	await expect(
		mobile.getByLabel('Тема', { exact: true }).locator('option', { hasText: 'Создана оффлайн' })
	).toHaveCount(1);
	await expect(mobile.getByLabel('Ось времени: клик по подписи выбирает период')).toHaveCSS(
		'height',
		'66px'
	);
	await mobile.screenshot({ path: testInfo.outputPath('shared-mobile.png') });
	await desktop.close();
	await phone.close();
});
