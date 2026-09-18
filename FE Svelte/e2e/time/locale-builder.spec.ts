import { expect, test } from '@playwright/test';
import { editor } from './draft.helpers';
import { loadTime } from './helpers';
import { ARTIFACTS, switchTo, WORDS } from './locale.helpers';
import { closeContext, panel, startCapture } from './results.helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('a pending Undo offer and the month wheel follow the language', async ({ page }) => {
	test.setTimeout(150_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await loadTime(page, { manifest: 'dense' });

	// A Scope deleted: the offer to take it back is worded when shown, and still takes it back.
	await closeContext(page);
	await page.getByRole('button', { name: 'Выбрать Scope Работа', exact: true }).click();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Работа');
	await panel(page).getByTestId('delete-scope').click();
	const toast = page.getByTestId('undo-toast');
	await expect(toast).toContainText('Scope удалён');
	await switchTo(page, 'en');
	await expect(toast).toContainText('Scope deleted');
	await expect(toast.getByTestId('undo')).toHaveText('Undo');
	await page.screenshot({ path: `${ARTIFACTS}/locale-complete-offer-en.png` });
	await toast.getByTestId('undo').click();
	await expect(toast).toHaveCount(0);
	await expect(panel(page).getByTestId('context-scope')).toBeVisible();
	await expect(panel(page).getByTestId('selected-title')).toHaveText('Работа');
	await switchTo(page, 'ru');

	// The month wheel of a coarse date: its names follow, the chosen month does not move.
	await startCapture(page);
	await editor(page).getByTestId('trace-time').click();
	await page.getByText(WORDS.ru.refine, { exact: true }).click();
	await page.getByLabel(WORDS.ru.precision, { exact: true }).selectOption('month');
	const monthsRu = page.getByRole('listbox', { name: WORDS.ru.month, exact: true });
	await expect(monthsRu).toBeVisible();
	const chosen = monthsRu.locator('[aria-selected=true]');
	const ruName = (await chosen.innerText()).trim();
	expect(ruName).toMatch(/^[а-яё]+$/i);
	const selectedIndex = (options: Element[]) =>
		options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
	const index = await monthsRu.getByRole('option').evaluateAll(selectedIndex);
	await switchTo(page, 'en');
	const monthsEn = page.getByRole('listbox', { name: WORDS.en.month, exact: true });
	await expect(monthsEn.locator('[aria-selected=true]')).toHaveText(/^[a-z]+$/i);
	expect(await monthsEn.getByRole('option').evaluateAll(selectedIndex)).toBe(index);
	await page.screenshot({ path: `${ARTIFACTS}/locale-complete-month-en.png` });
	await switchTo(page, 'ru');
	await expect(monthsRu.locator('[aria-selected=true]')).toHaveText(ruName);
	await page.getByRole('button', { name: WORDS.ru.cancelTime, exact: true }).click();
	await page.getByTestId('context-collapse').click();
	expect(errors).toEqual([]);
});
