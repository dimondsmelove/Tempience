import { expect, test, type Page } from '@playwright/test';
import { loadTime, settleCamera } from './helpers';
import { openEditor } from '../appearance.helpers';

test.use({ viewport: { width: 1225, height: 800 }, isMobile: false, hasTouch: false });
const labels = (page: Page) => page.getByRole('group', { name: 'Подписи оси', exact: true });
const zoomOut = async (page: Page, count: number) => {
	await page.getByRole('button', { name: 'Отдалить', exact: true }).evaluate((button, count) => {
		for (let i = 0; i < count; i++) (button as HTMLButtonElement).click();
	}, count);
	await settleCamera(page);
};
const readable = async (page: Page) => {
	const boxes = await labels(page)
		.locator('[data-row="major"]')
		.evaluateAll((nodes) =>
			nodes.map((node) => {
				const box = node.getBoundingClientRect();
				return { start: box.x, end: box.right };
			})
		);
	expect(boxes.length).toBeGreaterThan(1);
	for (let i = 1; i < boxes.length; i++)
		expect(boxes[i].start).toBeGreaterThanOrEqual(boxes[i - 1].end - 1);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
};

test('zoom removes crowded months and years; clicking a decade opens its full period', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await zoomOut(page, 7);
	await expect(labels(page).locator('[data-row="major"]').first()).toHaveAttribute(
		'data-unit',
		'year'
	);
	await expect(labels(page).locator('[data-unit="month"]')).toHaveCount(0);
	await readable(page);
	await zoomOut(page, 5);
	const decades = labels(page).locator('[data-row="major"]');
	await expect(decades.first()).toHaveAttribute('data-unit', 'decade');
	await expect(labels(page).locator('[data-unit="year"]')).toHaveCount(0);
	await readable(page);
	const decade = decades.filter({ hasText: '2020-е' });
	await decade.click();
	await expect(page.getByTestId('selected-title')).toHaveText('2020-е годы');
	await page.screenshot({ path: 'test-results/c9a-decades-context.png' });
});

test('maximum zoom stays readable with large text and narrow or wide desktop', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	await openEditor(page);
	await page.getByRole('button', { name: 'Это устройство', exact: true }).click();
	await page.getByLabel('Масштаб текста', { exact: false }).fill('1.5');
	await page.getByRole('button', { name: 'Применить', exact: true }).click();
	await zoomOut(page, 25);
	for (const width of [1180, 1920]) {
		await page.setViewportSize({ width, height: 800 });
		await expect(labels(page).locator('[data-row="major"]').first()).toHaveAttribute(
			'data-unit',
			'decade'
		);
		await expect(labels(page).locator('[data-row="minor"]')).toHaveCount(0);
		await readable(page);
		await page.screenshot({ path: `test-results/c9a-decades-${width}.png` });
	}
});
