import { expect, test } from '@playwright/test';
import { loadTime } from './helpers';

for (const width of [390, 1440]) {
	test.describe('Context editing at ' + width + 'px', () => {
		test.use({
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});

		test('replaces record details with the editor and restores them on cancel and save', async ({
			page
		}) => {
			await loadTime(page, { manifest: 'dense' });
			await page.getByTestId('ribbon-twin').getByRole('button').nth(3).dispatchEvent('click');
			const panel = page.getByTestId('context-body');
			const originalTitle = await panel.getByTestId('selected-title').innerText();
			await panel.getByTestId('edit-trace').click();
			await expect(panel.getByTestId('edit-trace-form')).toBeVisible();
			await expect(panel.getByTestId('context-overview')).toHaveCount(0);
			await expect(panel.getByTestId('context-links')).toHaveCount(0);
			await expect(panel.getByTestId('context-neighborhood')).toHaveCount(0);
			await expect(panel.getByTestId('belongings')).toHaveCount(0);
			await expect(panel.getByText('Технические данные', { exact: true })).toHaveCount(0);
			await expect(panel.getByRole('tablist')).toHaveCount(0);
			await panel.getByLabel('Название', { exact: true }).fill('Несохранённая правка');
			await panel.getByRole('button', { name: 'Отмена', exact: true }).click();
			// A changed form asks before it closes; «Отбросить изменения» completes the cancel.
			await page.getByTestId('discard-confirm').click();
			await expect(panel.getByTestId('selected-title')).toHaveText(originalTitle);
			await expect(panel.getByTestId('belongings')).toBeVisible();
			await panel.getByTestId('edit-trace').click();
			await panel.getByLabel('Название', { exact: true }).fill('Сохранённая правка Context');
			await panel.getByTestId('edit-save').click();
			await expect(panel.getByTestId('selected-title')).toHaveText('Сохранённая правка Context');
			await expect(panel.getByTestId('edit-trace-form')).toHaveCount(0);
		});

		test('a different selection and history return open the record in viewing mode', async ({
			page
		}) => {
			await loadTime(page, { manifest: 'dense' });
			const records = page.getByTestId('ribbon-twin').getByRole('button');
			await records.nth(3).dispatchEvent('click');
			const panel = page.getByTestId('context-body');
			const originalTitle = await panel.getByTestId('selected-title').innerText();
			await panel.getByTestId('edit-trace').click();
			await records.nth(4).dispatchEvent('click');
			await expect(panel.getByTestId('context-overview')).toBeVisible();
			await expect(panel.getByTestId('edit-trace-form')).toHaveCount(0);
			await page.getByTestId('history-back').click();
			await expect(panel.getByTestId('selected-title')).toHaveText(originalTitle);
			await expect(panel.getByTestId('edit-trace-form')).toHaveCount(0);
		});

		test('Scope editing hides the hierarchy and records until cancellation', async ({ page }) => {
			await loadTime(page, { manifest: 'dense' });
			if (width === 390) await page.getByRole('button', { name: 'Scope', exact: true }).click();
			await page.getByRole('button', { name: 'Выбрать Scope Работа', exact: true }).click();
			const scope = page.getByTestId('context-scope');
			await scope.getByRole('button', { name: 'Tempience', exact: true }).click();
			await expect(scope.getByRole('heading', { name: 'Родительский Scope' })).toBeVisible();
			await scope.getByRole('button', { name: 'Редактировать Scope', exact: true }).click();
			await expect(scope.getByTestId('scope-editor')).toBeVisible();
			await expect(scope.getByRole('heading', { name: 'Родительский Scope' })).toHaveCount(0);
			await expect(scope.getByTestId('scope-record')).toHaveCount(0);
			await expect(scope.getByText('Trace Kind для этого Scope', { exact: true })).toHaveCount(0);
			await scope.getByRole('button', { name: 'Отмена', exact: true }).click();
			await expect(scope.getByRole('heading', { name: 'Родительский Scope' })).toBeVisible();
			await expect(scope.getByTestId('scope-editor')).toHaveCount(0);
		});
	});
}
