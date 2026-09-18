import { expect, test } from '@playwright/test';
import { trackConsoleErrors } from './helpers';

test('Tempience opens the new Time at the root with canonical data', async ({ page }) => {
	const consoleErrors = trackConsoleErrors(page);
	await page.goto('/');
	await expect(page).toHaveTitle('Tempience');
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	await expect(page.getByTestId('identity-bar')).toHaveCount(1);
	await expect(
		page.getByTestId('identity-bar').getByRole('link', { name: 'Tempience' })
	).toHaveAttribute('href', '/');
	await expect(page.getByTestId('data-space-switcher')).toHaveValue('canonical');
	await expect(page.getByTestId('ribbon-canvas')).toBeVisible();
	await expect(page.getByTestId('scenario-data-space-menu')).toHaveCount(0);
	expect(consoleErrors).toEqual([]);
});
