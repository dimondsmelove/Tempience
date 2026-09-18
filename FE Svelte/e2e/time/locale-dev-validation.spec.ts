import { expect, test } from '@playwright/test';
import { instrumentBoundary, prepareBoundary } from './boundary.helpers';
import { badInput, editor, kinds } from './draft.helpers';
import { loadTime } from './helpers';
import { seedKind, SKIP, timeline } from './locale-dev.helpers';
import { ARTIFACTS, switchTo } from './locale.helpers';
import { startCapture } from './results.helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
test.beforeEach(({ page }) => prepareBoundary(page));

test('a pattern violation is worded by the interface in both languages; the control keeps its text and its identity', async ({
	page
}) => {
	test.setTimeout(120_000);
	await loadTime(page, { manifest: null });
	test.skip(!(await instrumentBoundary(page)), SKIP);
	await seedKind(page, 'Код-тест', {
		type: 'object',
		properties: { code: { type: 'string', pattern: '^[A-Z]{3}$', title: 'Код' } }
	});
	await timeline(page);
	await startCapture(page);
	await kinds(page).selectOption({ label: 'Код-тест' });
	const code = editor(page).getByRole('textbox', { name: /Код/ });
	await code.fill('ab');
	await page.getByTestId('draft-description').click();
	const messages = editor(page).locator('.sjsf-errors-list');
	await expect(messages).toContainText('Значение должно соответствовать шаблону ^[A-Z]{3}$');
	await code.evaluate((element) => ((element as HTMLInputElement).dataset.mark = 'kept'));
	await page.screenshot({ path: `${ARTIFACTS}/locale-dev-pattern-ru.png` });
	await switchTo(page, 'en');
	await expect(messages).toContainText('Must match the pattern ^[A-Z]{3}$');
	await expect(messages).not.toContainText('must match pattern');
	await expect(code).toHaveValue('ab');
	await expect(code).toHaveAttribute('data-mark', 'kept');
	await page.screenshot({ path: `${ARTIFACTS}/locale-dev-pattern-en.png` });
	await code.fill('ABC');
	await expect(messages).toHaveCount(0);
	await switchTo(page, 'ru');
	await expect(messages).toHaveCount(0);
	await expect(code).toHaveValue('ABC');
});

test("a title-less unit field's fallback name follows the language; the control keeps its identity and its unfinished text", async ({
	page
}) => {
	test.setTimeout(120_000);
	await loadTime(page, { manifest: null });
	test.skip(!(await instrumentBoundary(page)), SKIP);
	await seedKind(
		page,
		'Единицы',
		{ type: 'object', properties: { field_w: { type: 'number' } } },
		{ '/properties/field_w': { unit: { id: 'kg', label: 'кг' } } }
	);
	await timeline(page);
	await startCapture(page);
	await kinds(page).selectOption({ label: 'Единицы' });
	const value = editor(page).getByRole('spinbutton', { name: 'Значение, кг' });
	await expect(value).toBeVisible();
	await value.focus();
	await value.pressSequentially('-');
	expect(await badInput(value)).toBe(true);
	await value.evaluate((element) => ((element as HTMLInputElement).dataset.mark = 'kept'));
	// Left, the field says why the record cannot be saved yet.
	await page.getByTestId('draft-description').click();
	await expect(editor(page)).toContainText('Завершите ввод числа');
	await expect(editor(page).getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
	await switchTo(page, 'en');
	// The interface's word follows; the user's unit, the element and its unparsed text do not move.
	const valueEn = editor(page).getByRole('spinbutton', { name: 'Value, кг' });
	await expect(valueEn).toHaveAttribute('data-mark', 'kept');
	expect(await badInput(valueEn)).toBe(true);
	await expect(editor(page).getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
	await expect(editor(page)).toContainText('Finish the number in the form field');
	await page.screenshot({ path: `${ARTIFACTS}/locale-dev-unit-fallback-en.png` });
	await switchTo(page, 'ru');
	await expect(value).toHaveAttribute('data-mark', 'kept');
	await expect(editor(page)).toContainText('Завершите ввод числа');
});
