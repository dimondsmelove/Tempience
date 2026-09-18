import { expect, test } from '@playwright/test';
import { loadTime, settleCamera } from './helpers';

for (const width of [360, 390, 430]) {
	test(`phone ${width}: full-width canvas, actions and Scope share real rows`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		await loadTime(page, { manifest: 'dense' });
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-phone', 'true');
		const canvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
		expect(canvas.width).toBeGreaterThan(width - 4);
		expect(canvas.height).toBeGreaterThan(600);
		await expect(page.getByTestId('scope-canvas-names')).toBeVisible();
		const actions = (await page.getByTestId('mobile-actions').boundingBox())!;
		expect(actions.y + actions.height).toBeLessThanOrEqual(845);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.getByRole('button', { name: 'Scope', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Scope', exact: true })).toBeVisible();
		await page.getByRole('searchbox', { name: 'Поиск Scope' }).fill('Работа');
		await expect(
			page
				.getByTestId('scope-rail-rows')
				.getByRole('button', { name: 'Выбрать Scope Работа', exact: true })
		).toBeVisible();
		await page.getByRole('searchbox', { name: 'Поиск Scope' }).fill('');
		await page.getByTestId('scope-close').click();
		await page.getByTestId('filters-toggle').click();
		// The modal takes keyboard focus on the next animation frame.
		await expect(page.getByRole('dialog', { name: 'Фильтры', exact: true })).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
		await page.getByRole('button', { name: /Без даты/ }).click();
		await expect(page.getByRole('list', { name: 'Записи без даты' })).toBeVisible();
		await expect(page.getByRole('dialog', { name: 'Без даты', exact: true })).toBeFocused();
		await page.keyboard.press('Escape');
		await page.screenshot({ path: `test-results/mobile-${width}-lane.png` });
	});
}

test('phone Context keeps selection history through sheet stops and closure', async ({ page }) => {
	await loadTime(page);
	await page
		.getByTestId('scope-canvas-names')
		.getByRole('button', { name: 'Выбрать Scope Работа', exact: true })
		.click();
	await expect(page.getByTestId('selected-title')).toHaveText('Работа');
	await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'half');
	await page.getByTestId('scope-record').filter({ hasText: 'Начал проект' }).click();
	await settleCamera(page);
	await expect(page.getByTestId('selected-title')).toHaveText('Начал проект');
	await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
	await page.getByTestId('history-back').click();
	await expect(page.getByTestId('selected-title')).toHaveText('Работа');
	await page.getByTestId('history-forward').click();
	await expect(page.getByTestId('selected-title')).toHaveText('Начал проект');
	const grip = (await page
		.getByRole('button', { name: 'Высота Context: half', exact: true })
		.boundingBox())!;
	await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
	await page.mouse.down();
	await page.mouse.move(grip.x + grip.width / 2, grip.y - 220, { steps: 12 });
	await page.mouse.up();
	await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'full');
	const header = (await page.getByTestId('identity-bar').boundingBox())!;
	await expect
		.poll(async () =>
			Math.abs((await page.getByTestId('bottom-sheet').boundingBox())!.y - header.y - header.height)
		)
		.toBeLessThanOrEqual(1);
	await page.screenshot({ path: 'test-results/mobile-context-full.png' });
	await page.getByTestId('context-collapse').click();
	await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
	await expect(page.getByTestId('ribbon-twin').locator('[aria-current="true"]')).not.toHaveCount(0);
});

test('phone keeps Capture fields, validation and saved data in a shortened viewport', async ({
	page
}) => {
	await loadTime(page);
	await page.getByTestId('capture').click();
	await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'full');
	const initialTime = await page.getByTestId('trace-time').innerText();
	await page
		.getByRole('textbox', { name: 'Название', exact: true })
		.fill('Мобильная запись вчера 14:30');
	await page.setViewportSize({ width: 390, height: 470 });
	await page
		.getByRole('combobox', { name: 'Выбрать Scope', exact: true })
		.selectOption({ label: 'Работа' });
	// The title is never parsed into a date (TRACE_FORMS): the initial time stays.
	await expect(page.getByTestId('trace-time')).toHaveText(initialTime, { useInnerText: true });
	await page.getByTestId('capture-save').click();
	await expect(page.getByTestId('selected-title')).toHaveText('Мобильная запись вчера 14:30');
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByTestId('edit-trace').click();
	await expect(page.getByTestId('context-body')).toContainText('Сохранить');
	await page.screenshot({ path: 'test-results/mobile-editing.png' });
});

test('360 px and enlarged text keep appearance and capture reachable in the light theme', async ({
	page
}) => {
	await page.setViewportSize({ width: 360, height: 844 });
	await loadTime(page, { manifest: 'dense', theme: 'light' });
	await page.getByTestId('appearance-open').click();
	await page.getByRole('button', { name: 'Это устройство', exact: true }).click();
	await page.getByLabel('Масштаб текста', { exact: false }).fill('1.5');
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	for (const control of [page.getByTestId('appearance-open'), page.getByTestId('capture')]) {
		const box = (await control.boundingBox())!;
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(361);
	}
	await page
		.getByTestId('scope-canvas-names')
		.getByRole('button', { name: 'Выбрать Scope Работа', exact: true })
		.click();
	await expect(page.getByTestId('selected-title')).toHaveText('Работа');
	await page.screenshot({ path: 'test-results/mobile-360-light-large.png' });
	await page.getByTestId('capture').click();
	await expect(page.getByTestId('bottom-sheet')).toHaveAttribute('data-position', 'full');
	await expect(page.locator('section[aria-label="Time"]')).toHaveAttribute('inert', '');
	await page
		.getByRole('textbox', { name: 'Название', exact: true })
		.fill('Проверка крупного текста');
	// The general «Записать» starts without Scope, whatever is shown (TRACE_FORMS 2026-09-15).
	await expect(page.getByRole('list', { name: 'Выбранные Scope' })).toHaveCount(0);
	await expect(page.getByTestId('capture-save')).toBeEnabled();
	await page.getByTestId('capture-save').scrollIntoViewIfNeeded();
	await page.screenshot({ path: 'test-results/mobile-360-large-capture.png' });
});
