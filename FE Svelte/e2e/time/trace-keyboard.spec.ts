import { expect, test, type Page } from '@playwright/test';
import { ARTIFACTS, cleanConsole } from './draft.helpers';
import { loadTime } from './helpers';
import { captureIntention, panel, showOverview } from './results.helpers';

cleanConsole(test, 'i5b-console-keyboard.log');

const toast = (page: Page) => page.getByTestId('undo-toast');

/**
 * Walks the focus forward until the named control has it. Nothing is clicked: what is being
 * checked is that the control can be reached and used with the keyboard alone.
 */
const tabTo = async (page: Page, testId: string, limit = 250): Promise<number> => {
	for (let presses = 0; presses < limit; presses++) {
		const at = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
		if (at === testId) return presses;
		await page.keyboard.press('Tab');
	}
	throw new Error(`«${testId}» was not reachable with the keyboard in ${limit} presses.`);
};

/** Deleting the shown record and taking it back, with the keyboard and nothing else. */
const deleteAndUndo = async (page: Page, name: string): Promise<void> => {
	await showOverview(page);
	await page.locator('body').press('Tab');
	await tabTo(page, 'delete-trace');
	await page.keyboard.press('Enter');
	await expect(toast(page)).toBeVisible();
	await tabTo(page, 'undo');
	await page.keyboard.press('Enter');
	await expect(toast(page)).toHaveCount(0);
	await expect(panel(page).getByTestId('selected-title')).toHaveText(name);
};

test.describe('The Context under the keyboard at 1440', () => {
	test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

	test('deletes the shown record and takes it back without a pointer', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Кл1');
		await deleteAndUndo(page, 'План Кл1');
		await page.screenshot({ path: `${ARTIFACTS}/i5b-rev-keyboard-1440.png`, fullPage: true });
	});
});

test.describe('The Context under the keyboard at 390', () => {
	test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

	test('deletes the shown record and takes it back without a pointer', async ({ page }) => {
		test.setTimeout(180_000);
		await loadTime(page, { manifest: null });
		await captureIntention(page, 'План Кл2');
		await deleteAndUndo(page, 'План Кл2');
		await page.screenshot({ path: `${ARTIFACTS}/i5b-rev-keyboard-390.png`, fullPage: true });
	});
});
