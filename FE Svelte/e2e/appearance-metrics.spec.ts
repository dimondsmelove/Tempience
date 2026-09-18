import { expect, test } from '@playwright/test';
import { openEditor } from './appearance.helpers';
import { loadTime } from './time/helpers';

test('extreme spacing and typography retain an accessible editor and cancel cleanly', async ({
	page
}, testInfo) => {
	await loadTime(page, { manifest: null });
	await openEditor(page);
	await page.getByRole('button', { name: 'Светлая', exact: true }).click();
	await page.getByText('Типографика', { exact: true }).click();
	await page.getByLabel('Шрифт интерфейса', { exact: true }).selectOption('serif');
	for (const label of ['Текст контролов', 'Подписи', 'Основной текст']) {
		const input = page.getByRole('slider', { name: label });
		await input.focus();
		await input.press('End');
	}
	await page.getByText('Отступы, скругления и тени', { exact: true }).click();
	for (const label of [
		'Отступ внутри контролов: горизонталь',
		'Отступ внутри контролов: вертикаль',
		'Отступ внутри панелей',
		'Расстояние между элементами'
	]) {
		const input = page.getByRole('slider', { name: label });
		await input.focus();
		await input.press('End');
	}
	await page.getByRole('button', { name: 'Это устройство', exact: true }).click();
	for (const label of [/Масштаб текста:/, /Плотность:/]) {
		const input = page.getByRole('slider', { name: label });
		await input.focus();
		await input.press('End');
	}
	await page.setViewportSize({ width: 390, height: 844 });
	await page.screenshot({ path: testInfo.outputPath('extreme-mobile.png') });
	await expect(page.getByRole('button', { name: 'Отмена', exact: true })).toBeInViewport();
	expect(await page.getByRole('dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
		true
	);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByLabel('Ось времени: клик по подписи выбирает период')).toHaveCSS(
		'height',
		'44px'
	);
});

test('an incompatible device cache survives reload until an explicit reset', async ({ page }) => {
	await page.addInitScript(() => {
		if (!sessionStorage.getItem('e2e-invalid-appearance-injected')) {
			localStorage.setItem('tempience.appearance.v1', '{"formatVersion":999}');
			sessionStorage.setItem('e2e-invalid-appearance-injected', '1');
		}
	});
	await loadTime(page, { manifest: null });
	await openEditor(page);
	await expect(page.getByRole('alert')).toContainText('Неподдерживаемые локальные настройки');
	expect(await page.evaluate(() => localStorage.getItem('tempience.appearance.v1'))).toBe(
		'{"formatVersion":999}'
	);
	await page
		.getByRole('button', { name: 'Сбросить неподдерживаемые настройки устройства', exact: true })
		.click();
	await page.getByRole('button', { name: 'Отмена', exact: true }).click();
	await page.reload();
	await openEditor(page);
	await expect(page.getByRole('alert')).toHaveCount(0);
	await expect(page.getByLabel('Ось времени: клик по подписи выбирает период')).toHaveCSS(
		'height',
		'44px'
	);
});
