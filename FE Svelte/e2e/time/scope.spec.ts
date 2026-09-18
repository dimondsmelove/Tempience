import { expect, test, type Page } from '@playwright/test';
import { loadTime, resetFilters, closeScope } from './helpers';

test.use({ viewport: { width: 1225, height: 660 }, isMobile: false, hasTouch: false });

const rows = (page: Page) => page.getByTestId('scope-rail-rows').locator('[data-row-id]');
const expectAligned = async (page: Page) => {
	await expect
		.poll(async () => {
			const list = (await page.getByTestId('scope-rail-rows').boundingBox())!;
			const canvas = (await page.getByTestId('ribbon-canvas').boundingBox())!;
			return Math.abs(list.y - canvas.y);
		})
		.toBeLessThan(1);
};

test('disclosure and counters follow the same rows as the ribbon', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	await expect(rows(page)).toHaveCount(3);
	await expectAligned(page);
	await page.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true }).click();
	await page.getByRole('button', { name: 'Раскрыть Scope Tempience', exact: true }).click();
	await expect(rows(page).filter({ hasText: 'Фронт' })).toHaveCount(1);
	await expect(rows(page).first().getByTestId('scope-count')).toContainText('Σ');
	await expectAligned(page);
	await page.getByRole('separator', { name: 'Ширина Scope' }).press('Shift+ArrowRight');
	await expectAligned(page);
	await page.screenshot({ path: 'test-results/codex-scope/tree.png', animations: 'disabled' });
});

test('name search opens paths temporarily, filters the ribbon and clears to the saved tree', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await expect(rows(page)).toHaveCount(3);
	const before = await rows(page).evaluateAll((nodes) =>
		nodes.map((node) => node.getAttribute('data-row-id'))
	);
	const search = page.getByRole('searchbox', { name: 'Поиск Scope' });
	await search.fill('фРОНт');
	await expect(rows(page)).toHaveCount(3);
	await expect(rows(page).last()).toContainText('Фронт');
	await expect(
		page.getByRole('button', { name: 'Свернуть Scope Работа', exact: true })
	).toBeDisabled();
	await expect(page.getByTestId('filters-count')).toHaveText('1');
	await expectAligned(page);
	await search.fill('совпадений точно нет');
	await expect(rows(page)).toHaveCount(0);
	await expect(page.getByText('Scope не найдены.', { exact: true })).toBeVisible();
	await expect(page.getByText('Нет записей по выбранным фильтрам.', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Очистить поиск Scope' }).click();
	await expect(rows(page)).toHaveCount(3);
	expect(
		await rows(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-row-id')))
	).toEqual(before);
	await expect(
		page.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true })
	).toBeVisible();
	await expectAligned(page);
});

test('hidden scopes can be restored separately and the global reset clears search as well', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await page.getByRole('button', { name: 'Скрыть Scope Работа', exact: true }).click();
	await expect(rows(page).filter({ hasText: 'Работа' })).toHaveCount(0);
	await expect(rows(page).filter({ hasText: 'Дом' })).toHaveCount(1);
	await expect(rows(page).filter({ hasText: 'Здоровье' })).toHaveCount(1);
	await page.getByTestId('scope-menu-toggle').click();
	await page.getByRole('button', { name: 'Показать Scope Работа', exact: true }).click();
	await page.keyboard.press('Escape');
	await expect(rows(page)).toHaveCount(3);
	await page.getByRole('button', { name: 'Скрыть Scope Дом', exact: true }).click();
	await page.getByRole('searchbox', { name: 'Поиск Scope' }).fill('работа');
	await resetFilters(page);
	await expect(page.getByRole('searchbox', { name: 'Поиск Scope' })).toHaveValue('');
	await expect(rows(page)).toHaveCount(3);
	await expect(page.getByTestId('hidden-scopes-count')).toHaveText('Скрытые 0');
	await expectAligned(page);
});

test('compact Scope panel supports search, disclosure and close', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await loadTime(page, { manifest: 'dense' });
	await page.getByRole('button', { name: 'Scope', exact: true }).click();
	await page.getByRole('searchbox', { name: 'Поиск Scope' }).fill('Фронт');
	await expect(rows(page).last()).toContainText('Фронт');
	await page.getByRole('button', { name: 'Очистить поиск Scope' }).click();
	await page.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Раскрыть Scope Tempience', exact: true })
	).toBeVisible();
	await closeScope(page);
	await expect(page.getByRole('searchbox', { name: 'Поиск Scope' })).toHaveCount(0);
});
