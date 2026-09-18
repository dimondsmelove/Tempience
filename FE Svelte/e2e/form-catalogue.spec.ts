import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Belgrade', locale: 'ru-RU' });

test('builds a Kind with every offered field type and opens its data surface with one control per field', async ({
	page
}) => {
	await page.addInitScript(() =>
		localStorage.setItem('tempience.data-space.active', 'belgrade-what-if-v1')
	);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/forms');
	await expect(page.getByTestId('identity-bar')).toHaveCount(1);
	await page.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
	await page.getByLabel('Название Trace Kind').fill('Каталог полей');
	const root = page.getByTestId('form-field-list').first();
	const fields = root.locator(':scope > section');
	await fields.first().getByLabel('Название поля', { exact: true }).fill('Коротко');
	// Nested and repeating groups are no longer offered (TRACE_FORMS, 2026-09-15).
	for (const [type, title] of [
		['textarea', 'Подробно'],
		['number', 'Дробное'],
		['integer', 'Целое'],
		['boolean', 'Флажок'],
		['date', 'День'],
		['datetime', 'Время'],
		['choice', 'Один вариант'],
		['multi-choice', 'Несколько вариантов']
	]) {
		await root.getByRole('combobox', { name: 'Новое поле', exact: true }).selectOption(type);
		await root.getByRole('button', { name: 'Добавить поле', exact: true }).last().click();
		const field = fields.last();
		await field.getByLabel('Название поля', { exact: true }).first().fill(title);
		if (type === 'choice' || type === 'multi-choice') {
			await field.getByLabel('Вариант 1', { exact: true }).fill('Первый');
			await field.getByLabel('Вариант 2', { exact: true }).fill('Второй');
		}
	}
	await expect(
		root.getByRole('combobox', { name: 'Новое поле', exact: true }).locator('option')
	).toHaveCount(9);
	await page.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Заполнить', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Заполнить', exact: true }).click();
	// «Заполнить»: the Kind's table in the centre, its form in the Context (TRACE_FORMS «результат сохранения»).
	await expect(page.getByTestId('kind-data-surface')).toBeVisible();
	const form = page.getByTestId('trace-editor');
	await expect(form).toBeVisible();
	await expect(form.getByRole('textbox', { name: /^Коротко/ })).toBeVisible();
	await expect(form.getByRole('textbox', { name: /^Подробно/ })).toBeVisible();
	await expect(form.getByRole('spinbutton', { name: /^Дробное/ })).toBeVisible();
	await expect(form.getByRole('spinbutton', { name: /^Целое/ })).toBeVisible();
	await expect(form.getByRole('checkbox', { name: /^Флажок/ })).toBeVisible();
	await expect(form.locator('input[type=date]')).toBeVisible();
	await expect(form.locator('input[type=datetime-local]')).toBeVisible();
	await expect(form.getByRole('combobox', { name: /^Один вариант/ })).toBeVisible();
	await expect(form.getByRole('checkbox', { name: 'Первый', exact: true })).toBeVisible();
	await expect(form.getByRole('checkbox', { name: 'Второй', exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});
