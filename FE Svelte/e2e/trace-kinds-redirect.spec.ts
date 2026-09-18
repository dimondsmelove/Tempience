import { expect, test } from '@playwright/test';
import { trackConsoleErrors } from './helpers';

const SCENARIO_DATA_SPACE_ID = 'belgrade-what-if-v1';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/**
 * The retired `/trace-kinds` screens saved a record of their own — a generated title, no
 * Scope, no shared editor. Their addresses open the one catalog and the one Kind page now,
 * and nothing of that other way of saving can be reached.
 */
test('the old Kind addresses open the shared catalog and Kind page, never a second form', async ({
	page
}) => {
	await page.addInitScript((id: string) => {
		localStorage.setItem('tempience.data-space.active', id);
	}, SCENARIO_DATA_SPACE_ID);
	const consoleErrors = trackConsoleErrors(page);
	const pageErrors: string[] = [];
	page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));

	await page.goto('/trace-kinds?from=old');
	await expect(page).toHaveURL(/\/forms\?from=old$/);
	const forms = page.getByTestId('trace-forms');
	await expect(forms).toBeVisible();
	await expect(page.getByTestId('trace-type-builder')).toHaveCount(0);

	// A Kind made in the catalog: its page is where the old capture address lands.
	await forms.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
	await forms.getByLabel('Название Trace Kind').fill('Замер давления');
	await forms.getByLabel('Название поля', { exact: true }).fill('Давление');
	await forms.getByRole('combobox', { name: 'Тип поля', exact: true }).selectOption('number');
	await forms.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
	await expect(page).toHaveURL(/\/forms\/[^/?]+$/);
	const kindId = new URL(page.url()).pathname.split('/').at(-1)!;
	await page.goto(`/trace-kinds/${kindId}?from=old`);
	await expect(page).toHaveURL(new RegExp(`/forms/${kindId}\\?from=old$`));
	await expect(forms.getByRole('heading', { name: 'Замер давления' })).toBeVisible();
	await expect(page.getByTestId('trace-type-capture')).toHaveCount(0);
	await expect(page.getByTestId('generated-trace-form')).toHaveCount(0);
	// The only way to a record from here is the shared form in the workbench.
	await forms.getByRole('button', { name: 'Заполнить', exact: true }).click();
	await expect(page).toHaveURL(/\/$/);
	const editor = page.getByTestId('trace-editor');
	await expect(editor).toBeVisible();
	await expect(editor.getByRole('spinbutton', { name: /Давление/ })).toBeVisible();
	await expect(editor.getByLabel('Выбрать Scope')).toBeVisible();
	await expect(editor.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();

	// An old address of a Kind that does not exist here is answered, not a blank page.
	await page.goto('/trace-kinds/no-such-kind');
	await expect(page).toHaveURL(/\/forms\/no-such-kind$/);
	await expect(page.getByText('Trace Kind не найден.')).toBeVisible();
	expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
	expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([]);
});
