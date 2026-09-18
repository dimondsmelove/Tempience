import { expect, test } from '@playwright/test';
import { dialog, editor } from './draft.helpers';
import { loadTime } from './helpers';
import { ARTIFACTS, exportRows, said, switchTo, WORDS } from './locale.helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('an invalid typed form rewords its messages without remounting; array controls, nested Scope authoring and the stored rows survive the switch', async ({
	page
}) => {
	test.setTimeout(150_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await loadTime(page, { manifest: 'dense' });
	// A Kind made in the catalog: a whole number of at least 1 (groups are not offered, TRACE_FORMS 2026-09-15).
	await page.getByTestId('kinds-open').click();
	const forms = page.getByTestId('trace-forms');
	await forms.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
	await forms.getByLabel('Название Trace Kind').fill('Пульс');
	const root = forms.getByTestId('form-field-list').first();
	const fields = root.locator(':scope > section');
	await fields.first().getByLabel('Название поля', { exact: true }).fill('Удары');
	await fields
		.first()
		.getByRole('combobox', { name: 'Тип поля', exact: true })
		.selectOption('integer');
	await fields.first().getByLabel('Минимальное значение').fill('1');
	await forms.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
	await expect(forms.getByRole('status')).toContainText('Trace Kind создан');
	await forms.getByTestId('kind-data').click();
	const data = page.getByTestId('kind-data-surface');
	await expect(data).toBeVisible();
	const before = await exportRows(page, 'ru');

	await data.getByRole('button', { name: WORDS.ru.record, exact: true }).click();
	const form = editor(page);
	const beats = form.getByRole('spinbutton', { name: /Удары/ });
	await beats.fill('0');
	await beats.blur();
	await expect(said(form, 'Не меньше 1')).toBeVisible();
	await beats.evaluate((element) => ((element as HTMLInputElement).dataset.mark = 'kept'));

	await switchTo(page, 'en');
	// The interface's words, never AJV's; the control is the same element with its value.
	await expect(said(form, 'At least 1')).toBeVisible();
	await expect(said(form, /must be|must match/)).toHaveCount(0);
	await expect(beats).toHaveValue('0');
	await expect(beats).toHaveAttribute('data-mark', 'kept');
	await expect(form.getByRole('button', { name: WORDS.en.save, exact: true })).toBeDisabled();
	// An emptied control holds null (Svelte's empty number): a type refusal in the interface's words.
	await beats.fill('');
	await expect(said(form, 'Enter a whole number')).toBeVisible();
	await page.screenshot({ path: `${ARTIFACTS}/locale-complete-invalid-en.png` });

	// A Scope made inside the open form: the nested step keeps its input across a switch.
	await page.getByTestId('draft-scope-new').click();
	const nested = page.getByTestId('nested-editor');
	await expect(nested).toBeVisible();
	await nested.getByLabel('Scope name').fill('Кардио');
	await switchTo(page, 'ru');
	await expect(nested.getByLabel('Название Scope')).toHaveValue('Кардио');
	await switchTo(page, 'en');
	await expect(nested.getByLabel('Scope name')).toHaveValue('Кардио');
	// Three switches with an open invalid form and a pending nested step changed no stored
	// row of any collection: the export before equals the export after, row by row.
	await nested.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(nested).toHaveCount(0);
	await expect(said(form, 'Enter a whole number')).toBeVisible();
	expect(await exportRows(page, 'en')).toEqual(before);
	await expect(said(form, 'Enter a whole number')).toBeVisible();
	// The nested Scope saved for real returns to the same input.
	await page.getByTestId('draft-scope-new').click();
	await nested.getByLabel('Scope name').fill('Кардио');
	await nested.getByRole('button', { name: 'Save the Scope', exact: true }).click();
	await expect(nested).toHaveCount(0);
	await expect(
		form.getByRole('button', { name: 'Remove Scope Кардио', exact: true })
	).toBeVisible();
	await switchTo(page, 'ru');
	await expect(
		form.getByRole('button', { name: 'Убрать Scope Кардио', exact: true })
	).toBeVisible();
	await expect(said(form, 'Введите целое число')).toBeVisible();
	await page.getByTestId('context-collapse').click();
	await dialog(page).getByTestId('discard-confirm').click();
	await expect(form).toHaveCount(0);
	expect(errors).toEqual([]);
});
