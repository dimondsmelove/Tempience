import { expect, test } from '@playwright/test';
import { loadTime } from './helpers';
import {
	ARTIFACTS,
	badInput,
	cleanConsole,
	createKind,
	description,
	dialog,
	editor,
	kinds,
	record,
	title
} from './draft.helpers';

cleanConsole(test, 'i4a-console-lifecycle.log');

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

test.describe('One open form across the responsive breakpoint', () => {
	test.use({ viewport: DESKTOP, isMobile: false, hasTouch: false });

	test('a typed capture with unparsable text survives desktop → phone → desktop', async ({
		page
	}) => {
		test.setTimeout(90000);
		await loadTime(page, { manifest: 'dense' });
		await createKind(page, 'Наблюдение', 'Число', { required: false });
		await page.goto('/time');
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
		await page.getByTestId('capture').click();
		await kinds(page).selectOption({ label: 'Наблюдение' });
		await description(page).fill('PRIMARY rotation draft 20260913');
		const number = editor(page).getByRole('spinbutton', { name: /Число/ });
		await number.focus();
		await number.pressSequentially('-');
		await description(page).focus();
		await expect(editor(page).getByRole('alert')).toHaveText('Завершите ввод числа в поле формы');
		await page.setViewportSize(PHONE);
		// The phone shows the same form in its sheet: no question, nothing lost.
		await expect(page.getByTestId('bottom-sheet')).toBeVisible();
		await expect(dialog(page)).toHaveCount(0);
		await expect(kinds(page)).toHaveValue(/.+/);
		await expect(description(page)).toHaveValue('PRIMARY rotation draft 20260913');
		expect(await badInput(editor(page).getByRole('spinbutton', { name: /Число/ }))).toBe(true);
		await expect(editor(page).getByRole('alert')).toHaveText('Завершите ввод числа в поле формы');
		await page.screenshot({ path: `${ARTIFACTS}/i4a-review-rotation-phone.png` });
		await page.setViewportSize(DESKTOP);
		await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
		await expect(page.getByRole('complementary', { name: 'Context' })).toBeVisible();
		await expect(description(page)).toHaveValue('PRIMARY rotation draft 20260913');
		expect(await badInput(editor(page).getByRole('spinbutton', { name: /Число/ }))).toBe(true);
		await page.screenshot({ path: `${ARTIFACTS}/i4a-review-rotation-desktop.png` });
		// The time subview of the same form also survives the breakpoint.
		await editor(page).getByTestId('trace-time').click();
		await expect(page.getByTestId('trace-time-editor')).toBeVisible();
		await page.setViewportSize(PHONE);
		await expect(page.getByTestId('trace-time-editor')).toBeVisible();
		await page.getByRole('button', { name: 'Отменить изменение времени', exact: true }).click();
		await expect(description(page)).toHaveValue('PRIMARY rotation draft 20260913');
		// Closing the sheet on the phone is an exit: it asks, and discarding ends the form.
		await page.getByTestId('context-collapse').click();
		await expect(dialog(page)).toBeVisible();
		await dialog(page).getByTestId('discard-confirm').click();
		await expect(page.getByTestId('bottom-sheet')).toHaveCount(0);
		await page.setViewportSize(DESKTOP);
		await expect(page.getByTestId('context-capture')).toHaveCount(0);
	});

	test('an edit form survives phone → desktop → phone with its touched state', async ({ page }) => {
		await loadTime(page, { manifest: 'dense' });
		await page.setViewportSize(PHONE);
		await record(page, 3).dispatchEvent('click');
		const panel = page.getByTestId('context-body');
		const original = await panel.getByTestId('selected-title').innerText();
		await panel.getByTestId('edit-trace').click();
		await title(page).fill('');
		await description(page).focus();
		await expect(editor(page).getByRole('alert')).toHaveText('Введите название');
		await title(page).fill(original + ' · правка на телефоне');
		await page.setViewportSize(DESKTOP);
		await expect(page.getByRole('complementary', { name: 'Context' })).toBeVisible();
		await expect(title(page)).toHaveValue(original + ' · правка на телефоне');
		await expect(editor(page).getByTestId('edit-save')).toBeEnabled();
		await page.setViewportSize(PHONE);
		await expect(title(page)).toHaveValue(original + ' · правка на телефоне');
		await editor(page).getByTestId('edit-save').click();
		await expect(panel.getByTestId('selected-title')).toHaveText(
			original + ' · правка на телефоне'
		);
	});
});

test.describe('Native history with an open form', () => {
	test.use({ viewport: DESKTOP, isMobile: false, hasTouch: false });

	test('a confirmed Back stays a Back: Forward returns, Keep leaves history and input alone', async ({
		page
	}) => {
		await loadTime(page, { manifest: 'dense' });
		await page.goto('/forms');
		await page.getByRole('link', { name: 'Tempience', exact: true }).click();
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
		const length = await page.evaluate(() => history.length);
		await page.getByTestId('capture').click();
		await title(page).fill('PRIMARY native back review');
		await page.goBack();
		await expect(dialog(page)).toBeVisible();
		await dialog(page).getByTestId('discard-keep').click();
		await expect(page).toHaveURL(/\/$/);
		await expect(title(page)).toHaveValue('PRIMARY native back review');
		expect(await page.evaluate(() => history.length)).toBe(length);
		await page.goBack();
		await dialog(page).getByTestId('discard-confirm').click();
		await expect(page).toHaveURL(/\/forms$/);
		expect(await page.evaluate(() => history.length)).toBe(length);
		await page.goForward();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
		await expect(page.getByTestId('context-capture')).toHaveCount(0);
	});
});
