import { expect, test, type Page } from '@playwright/test';
import { chooseScale, loadTime } from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const context = (page: Page) => page.getByRole('complementary', { name: 'Context' });
const proposals = (page: Page) => page.getByTestId('ribbon-twin').locator('button[data-proposal]');

test('a manifest under review shows as proposals, one is confirmed and applied in place', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense', proposals: 'small' });
	await expect(page.getByTestId('proposals-pending')).toContainText(/На проверке [1-9]\d*/);
	await chooseScale(page, '3 года');
	await expect(proposals(page).first()).toBeAttached();
	const before = await proposals(page).count();
	await proposals(page).first().dispatchEvent('click');
	const view = context(page).getByTestId('context-proposal');
	await expect(view).toBeVisible();
	await expect(view.getByTestId('decide-accepted')).toHaveAttribute('aria-pressed', 'false');
	await view.getByTestId('decide-accepted').click();
	await expect(view.getByTestId('decide-accepted')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('apply-proposals')).toContainText('1');
	await page.getByTestId('apply-proposals').click();
	await expect(context(page).getByTestId('context-overview')).toBeVisible();
	// Entity selection fits its time; compare proposal counts at the same wide scale.
	await chooseScale(page, '3 года');
	await expect(proposals(page)).toHaveCount(before - 1);
	await expect(page.getByTestId('apply-proposals')).toBeHidden();
});

test('proposals persist through a reload in the local checkpoint and can be rejected', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense', proposals: 'small' });
	await chooseScale(page, '3 года');
	await expect(proposals(page).first()).toBeAttached();
	const before = await proposals(page).count();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Записать', exact: true })).toBeVisible({
		timeout: 20_000
	});
	await chooseScale(page, '3 года');
	await expect(proposals(page)).toHaveCount(before);
	await proposals(page).first().dispatchEvent('click');
	await context(page).getByTestId('decide-excluded').click();
	// Entity selection fits its time; compare proposal counts at the same wide scale.
	await chooseScale(page, '3 года');
	await expect(proposals(page)).toHaveCount(before - 1);
});
