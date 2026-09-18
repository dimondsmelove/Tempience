import { expect, test } from '@playwright/test';
import { E2E_DATA_SPACE_ID, loadTime } from './time/helpers';

test('an Explorer bookmark opens current Time and preserves the query and database', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await page.goto('/explorer?from=bookmark');
	await expect(page).toHaveURL(/\/\?from=bookmark$/);
	await expect(page).toHaveTitle('Tempience');
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	await expect(page.getByTestId('data-space-switcher')).toHaveValue(E2E_DATA_SPACE_ID);
	await expect(page.getByTestId('ribbon-twin').getByRole('button').first()).toBeAttached();
});
