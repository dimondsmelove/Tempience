import { expect, test } from '@playwright/test';
import { loadTime } from './helpers';

for (const width of [1440, 390]) {
	test(`a persisted link stays a distinct selection with endpoint history at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await loadTime(page, { manifest: 'dense' });
		await page.getByTestId('ribbon-twin').getByRole('button').first().dispatchEvent('click');
		const details = page.getByTestId('belonging-details').first();
		await expect(details).toBeVisible();
		const traceTitle = await page.getByTestId('selected-title').innerText();
		await details.click();
		const entity = page.getByTestId('context-entity');
		await expect(entity).toHaveAttribute('data-entity-role', 'intersection');
		await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
		await page.screenshot({ path: `e2e/artifacts/entities-${width}.png` });
		await expect(entity.getByTestId('entity-endpoint')).toHaveCount(2);
		await entity.getByTestId('entity-endpoint').filter({ hasText: traceTitle }).click();
		await expect(page.getByTestId('selected-title')).toHaveText(traceTitle);
		await expect(page.getByTestId('history-position')).toHaveText('3 / 3');
		await page.getByTestId('history-back').click();
		await expect(entity).toHaveAttribute('data-entity-role', 'intersection');
		await entity.locator('[data-testid="entity-endpoint"][data-entity-role="scope"]').click();
		await expect(page.getByTestId('context-scope')).toBeVisible();
		// The record stands in the Scope's «Записи»; «Связи» keeps the other links (owner 2026-09-15).
		await expect(page.getByTestId('scope-record').filter({ hasText: traceTitle })).toBeVisible();
		await expect(page.getByTestId('history-position')).toHaveText('3 / 3');
		await expect(page.getByTestId('history-forward')).toBeDisabled();
	});
}
