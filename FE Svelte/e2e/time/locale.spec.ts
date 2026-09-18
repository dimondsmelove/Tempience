import { expect, test } from '@playwright/test';
import { loadTime } from './helpers';

const ARTIFACTS = 'e2e/artifacts';

test.describe('desktop', () => {
	test.use({ viewport: { width: 1225, height: 800 }, isMobile: false, hasTouch: false });

	test('language changes without discarding a draft or navigation and survives an offline reload', async ({
		page,
		context
	}) => {
		await loadTime(page);
		await page.getByTestId('capture').click();
		// The field's label follows the language; the draft's own test id does not.
		const draft = page.getByTestId('draft-title');
		await draft.fill('Моя запись сегодня');
		await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
		const url = page.url();
		await page.getByTestId('locale-picker').selectOption('en');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(page.getByTestId('appearance-open')).toHaveText('Appearance');
		await expect(page.getByTestId('locale-picker')).toHaveAccessibleName('Interface language');
		await expect(draft).toHaveValue('Моя запись сегодня');
		// Switching is a browser preference: the workbench route and the open editor stay as they were.
		expect(page.url()).toBe(url);
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
		await page.getByTestId('locale-picker').selectOption('ru');
		await expect(page.getByTestId('appearance-open')).toHaveText('Внешний вид');
		await expect(draft).toHaveValue('Моя запись сегодня');
		await page.getByTestId('locale-picker').selectOption('en');
		await page.screenshot({ path: `${ARTIFACTS}/locale-desktop-en.png` });
		await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
		await context.setOffline(true);
		await page.reload();
		await expect(page.getByTestId('appearance-open')).toHaveText('Appearance');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await page.screenshot({ path: `${ARTIFACTS}/locale-desktop-offline-en.png` });
		await context.setOffline(false);
	});

	test('the identity bar keeps its height with the language picker', async ({ page }) => {
		await loadTime(page, { manifest: 'dense' });
		expect((await page.getByTestId('identity-bar').boundingBox())!.height).toBe(36);
		await expect(page.getByTestId('locale-picker')).toHaveValue('ru');
	});
});

test.describe('mobile', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	test('language picker and appearance stay inside the narrow header in both languages', async ({
		page
	}) => {
		await loadTime(page);
		for (const language of ['ru', 'en']) {
			await page.getByTestId('locale-picker').selectOption(language);
			await expect(page.locator('html')).toHaveAttribute('lang', language);
			for (const control of ['locale-picker', 'appearance-open']) {
				const box = await page.getByTestId(control).boundingBox();
				expect(box, control).not.toBeNull();
				expect(box!.x).toBeGreaterThanOrEqual(0);
				expect(box!.x + box!.width).toBeLessThanOrEqual(390);
			}
			await page.screenshot({ path: `${ARTIFACTS}/locale-mobile-${language}.png` });
		}
	});
});
