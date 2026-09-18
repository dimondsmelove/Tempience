import { expect, test, type Page } from '@playwright/test';
import { loadTime, chooseScale, closeScope, settleCamera } from './helpers';
import { openEditor } from '../appearance.helpers';

test.use({ viewport: { width: 1225, height: 800 }, isMobile: false, hasTouch: false });
const rows = (page: Page) => page.getByTestId('scope-rail-rows').locator('[data-row-id]');
const checkGeometry = async (page: Page) => {
	await settleCamera(page);
	// A selection can start smooth scrolling; sample both columns in the same frame.
	const geometry = await page.evaluate(() => {
		const canvas = document.querySelector('[data-testid="ribbon-canvas"]')!.getBoundingClientRect();
		const rows = document.querySelectorAll('[data-testid="scope-rail-rows"] [data-row-id]');
		const rail = rows[0].getBoundingClientRect();
		return {
			delta: Math.abs(canvas.y - rail.y),
			height: canvas.height,
			rows: rows.length * rail.height,
			overflow: document.documentElement.scrollWidth > innerWidth
		};
	});
	expect(geometry.delta).toBeLessThan(1);
	expect(geometry.height).toBe(geometry.rows);
	expect(geometry.overflow).toBe(false);
};
for (const theme of ['dark', 'light'] as const) {
	for (const width of [1225, 1180, 1920]) {
		test(`desktop ${width} ${theme}: dense reading, filters and selection`, async ({ page }) => {
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await page.setViewportSize({ width, height: 800 });
			await loadTime(page, { manifest: 'dense', theme });
			for (const name of ['Дом', 'Здоровье', 'Работа'])
				await page.getByRole('button', { name: `Раскрыть Scope ${name}`, exact: true }).click();
			await expect.poll(() => rows(page).count()).toBeGreaterThan(3);
			const entry = page.getByTestId('ribbon-twin').getByRole('button').first();
			await entry.focus();
			await entry.press('Enter');
			await expect(page.getByTestId('selected-title')).not.toBeEmpty();
			await expect
				.poll(() =>
					page
						.locator('section[aria-label="Time"] > .overflow-auto')
						.evaluate((node) => node.scrollTop)
				)
				.toBe(0);
			await checkGeometry(page);
			await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
			await page.screenshot({ path: `test-results/c9a-desktop/${width}-${theme}.png` });
			await page.getByTestId('filters-toggle').click();
			await expect(page.getByTestId('legend')).toBeVisible();
			const popup = (await page.locator('#time-filters').boundingBox())!;
			expect(popup.x).toBeGreaterThanOrEqual(0);
			expect(popup.x + popup.width).toBeLessThanOrEqual(width);
			await page.screenshot({ path: `test-results/c9a-desktop/${width}-${theme}-filters.png` });
			await page.keyboard.press('Escape');
			expect(errors).toEqual([]);
		});
	}
}

test('one Scope can use the screen height; fonts, hit areas and panel changes preserve its height and selection', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await page.getByRole('button', { name: 'Скрыть Scope Дом', exact: true }).click();
	await page.getByRole('button', { name: 'Скрыть Scope Здоровье', exact: true }).click();
	await expect(rows(page)).toHaveCount(1);
	await page.getByTestId('ribbon-twin').getByRole('button').first().dispatchEvent('click');
	const title = await page.getByTestId('selected-title').textContent();
	await openEditor(page);
	await page.getByRole('button', { name: 'Это устройство', exact: true }).click();
	for (let i = 0; i < 20; i++)
		await page.getByRole('button', { name: 'Увеличить высоту строк' }).click();
	await page.getByLabel('Масштаб текста', { exact: false }).fill('1.5');
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect.poll(async () => (await rows(page).first().boundingBox())!.height).toBe(532);
	await checkGeometry(page);
	await expect(page.getByTestId('window-dates')).toBeHidden();
	await expect(page.getByTestId('history-position')).toHaveCSS('white-space', 'nowrap');
	await page.getByTestId('go-to-selected').click();
	await settleCamera(page);
	await expect(page.getByTestId('selected-title')).toHaveText(title!);
	await page.screenshot({ path: 'test-results/c9a-desktop/one-scope-large-type.png' });
	await page.getByTestId('context-collapse').click();
	await expect.poll(async () => (await rows(page).first().boundingBox())!.height).toBe(532);
	await page.getByRole('button', { name: 'Context', exact: true }).click();
	await expect(page.getByTestId('selected-title')).toHaveText(title!);
	await page.getByRole('separator', { name: 'Ширина Context' }).press('Shift+ArrowLeft');
	await expect.poll(async () => (await rows(page).first().boundingBox())!.height).toBe(532);
	await closeScope(page);
	await page.getByRole('button', { name: 'Scope', exact: true }).click();
	await expect.poll(async () => (await rows(page).first().boundingBox())!.height).toBe(532);
});

for (const manifest of ['small', null] as const) {
	test(`desktop ${manifest ?? 'empty'} corpus remains navigable`, async ({ page }) => {
		await loadTime(page, { manifest });
		if (manifest) {
			await chooseScale(page, '3 года');
			await expect(page.getByTestId('ribbon-twin').getByRole('button').first()).toBeAttached();
			await checkGeometry(page);
		} else {
			await expect(rows(page)).toHaveCount(0);
			await expect(page.getByText('Записей нет: лента пуста.', { exact: true })).toBeVisible();
		}
		await expect(page.getByText('Выбери запись или период', { exact: true })).toBeVisible();
		await page.screenshot({ path: `test-results/c9a-desktop/${manifest ?? 'empty'}.png` });
		await page.getByTestId('capture').click();
		await expect(page.getByTestId('context-capture')).toBeVisible();
	});
}

test('minimum height keeps enlarged serif captions and hit areas inside their rows', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	for (const name of ['Дом', 'Здоровье', 'Работа'])
		await page.getByRole('button', { name: `Раскрыть Scope ${name}`, exact: true }).click();
	await openEditor(page);
	await page.getByRole('button', { name: 'Это устройство', exact: true }).click();
	await page.getByLabel('Масштаб текста', { exact: false }).fill('1.5');
	await page.getByRole('button', { name: 'Настроить тему', exact: true }).click();
	await page.getByText('Типографика', { exact: true }).click();
	await page.getByLabel('Шрифт интерфейса', { exact: true }).selectOption('serif');
	await expect(page.getByTestId('ribbon-canvas')).toHaveCSS('font-family', /Georgia/);
	await expect.poll(async () => (await rows(page).first().boundingBox())!.height).toBe(52);
	const entries = page.getByTestId('ribbon-twin').locator('button[data-label-y]');
	await expect(entries.first()).toBeAttached();
	const coordinates = await entries.evaluateAll((nodes) =>
		nodes.map((node) => ({
			mark: Number(node.getAttribute('data-y')),
			label: Number(node.getAttribute('data-label-y'))
		}))
	);
	for (const { mark, label } of coordinates) {
		const top = Math.floor(mark / 52) * 52;
		expect(label - 9).toBeGreaterThanOrEqual(top - 0.1);
		expect(label + 9).toBeLessThanOrEqual(top + 52.1);
	}
	await page.getByRole('button', { name: 'Отмена', exact: true }).click();
	await expect.poll(async () => (await rows(page).first().boundingBox())!.height).toBe(52);
});
