import { expect, test, type Page } from '@playwright/test';
import { loadTime } from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const context = (page: Page) => page.getByRole('complementary', { name: 'Context' });
const title = (page: Page) => context(page).getByTestId('selected-title');
const pickRecord = async (page: Page, index = 3): Promise<string> => {
	await page.getByTestId('ribbon-twin').getByRole('button').nth(index).dispatchEvent('click');
	await expect(title(page)).not.toBeEmpty();
	return title(page).innerText();
};

test('a record is edited in place and its time stays until explicitly changed', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await pickRecord(page);
	const panel = context(page);
	const time = await panel.getByTestId('selected-time').innerText();
	await panel.getByTestId('edit-trace').click();
	await expect(panel.getByTestId('trace-time')).toBeVisible();
	await expect(panel.getByTestId('trace-time-editor')).toHaveCount(0);
	await panel.getByTestId('trace-time').click();
	await panel.getByRole('button', { name: 'Применить время', exact: true }).click();
	await panel.getByLabel('Название', { exact: true }).fill('Правка e2e');
	await panel.getByTestId('edit-save').click();
	await expect(title(page)).toHaveText('Правка e2e');
	await expect(panel.getByTestId('selected-time')).toHaveText(time);
});

test('a membership is removed and the toast takes it back', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	await pickRecord(page);
	const panel = context(page);
	const before = await panel.getByTestId('belonging').count();
	expect(before).toBeGreaterThan(0);
	await panel.getByTestId('belonging-remove').first().click();
	await expect(panel.getByTestId('belonging')).toHaveCount(before - 1);
	await expect(page.getByTestId('undo-toast')).toContainText('Убрано');
	await page.getByTestId('undo').click();
	await expect(panel.getByTestId('belonging')).toHaveCount(before);
	await expect(page.getByTestId('undo-toast')).toBeHidden();
});

test('«удалить везде» soft-deletes the record and undo brings it back selected', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const name = await pickRecord(page);
	await context(page).getByTestId('delete-trace').click();
	await expect(context(page).getByText('Выбери запись или период', { exact: true })).toBeVisible();
	await expect(page.getByTestId('undo-toast')).toContainText('Запись удалена');
	await page.getByTestId('undo').click();
	await expect(title(page)).toHaveText(name);
});

test('«Найти и связать…» links two records and the link can be removed', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	await pickRecord(page);
	const panel = context(page);
	await expect(panel.getByTestId('context-links')).toBeVisible();
	const before = await panel.getByTestId('link-target').count();
	await panel.getByTestId('link-search-open').click();
	await panel.getByTestId('link-search').fill('Тест');
	await expect(panel.getByTestId('link-candidate').first()).toBeVisible();
	const candidate = await panel.getByTestId('link-candidate').first().innerText();
	await panel.getByTestId('link-candidate').first().click();
	await expect(panel.getByTestId('link-target')).toHaveCount(before + 1);
	await expect(panel.getByTestId('context-links')).toContainText('Связанные');
	expect(candidate.length).toBeGreaterThan(0);
	await panel.getByTestId('link-remove').first().click();
	await expect(panel.getByTestId('link-target')).toHaveCount(before);
	await expect(page.getByTestId('undo-toast')).toContainText('снята');
});
