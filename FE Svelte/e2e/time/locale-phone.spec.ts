import { expect, test } from '@playwright/test';
import { editor } from './draft.helpers';
import { loadTime } from './helpers';
import { ARTIFACTS, switchTo, WORDS } from './locale.helpers';
import { panel } from './results.helpers';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('the bar, the sheet, the time picker and the Context tabs stay inside 390px in both languages, named for the keyboard; a reload keeps the choice', async ({
	page
}) => {
	test.setTimeout(90_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await loadTime(page, { manifest: 'dense' });
	for (const language of ['en', 'ru'] as const) {
		await switchTo(page, language);
		for (const control of [
			'locale-picker',
			'appearance-open',
			'kinds-open',
			'capture',
			'filters-toggle'
		]) {
			const box = await page.getByTestId(control).boundingBox();
			expect(box, control).not.toBeNull();
			expect(box!.x, control).toBeGreaterThanOrEqual(0);
			expect(box!.x + box!.width, control).toBeLessThanOrEqual(390);
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.getByTestId('capture').click();
		const form = editor(page);
		await expect(form).toBeVisible();
		await expect(
			form.getByRole('button', { name: WORDS[language].save, exact: true })
		).toBeVisible();
		await form.getByTestId('trace-time').click();
		await expect(page.getByTestId('trace-time-editor')).toBeVisible();
		await expect(
			page.getByRole('group', { name: WORDS[language].when, exact: true })
		).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.screenshot({ path: `${ARTIFACTS}/locale-complete-phone-${language}.png` });
		await page.getByRole('button', { name: WORDS[language].cancelTime, exact: true }).click();
		await expect(page.getByTestId('trace-time-editor')).toHaveCount(0);
		await page.getByTestId('context-collapse').click();
		await expect(form).toHaveCount(0);
	}
	// The sheet of a selected record: its tabs reword and the open tab stays open.
	await page.getByTestId('ribbon-twin').getByRole('button').first().dispatchEvent('click');
	const body = panel(page);
	await expect(body.getByRole('tab', { name: WORDS.ru.overview })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await body.getByRole('tab', { name: WORDS.ru.links }).click();
	await switchTo(page, 'en');
	await expect(body.getByRole('tab', { name: WORDS.en.links })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(body.getByRole('tab', { name: WORDS.en.overview })).toBeVisible();
	await expect(body.getByTestId('context-links')).toBeVisible();
	await page.screenshot({ path: `${ARTIFACTS}/locale-complete-phone-tabs-en.png` });
	await page.reload();
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready', {
		timeout: 20_000
	});
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.getByTestId('appearance-open')).toHaveText(WORDS.en.appearance);
	expect(errors).toEqual([]);
});
