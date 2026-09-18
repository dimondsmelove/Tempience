import { appendFileSync } from 'node:fs';
import { expect, type Locator, type Page, type TestType } from '@playwright/test';

export const ARTIFACTS = 'e2e/artifacts';

export const editor = (page: Page): Locator => page.getByTestId('trace-editor');
export const title = (page: Page): Locator => editor(page).getByLabel('Название', { exact: true });
export const description = (page: Page): Locator =>
	editor(page).getByLabel('Описание', { exact: true });
/** The mode switch below Trace Kind: Событие · Намерение · Итог намерения (TRACE_FORMS 2026-09-15). */
export const modes = (page: Page): Locator => editor(page).getByTestId('draft-mode');
export const mode = (page: Page, value: 'actual' | 'intend' | 'evidence'): Locator =>
	modes(page).locator(`[data-mode="${value}"]`);
export const kinds = (page: Page): Locator =>
	editor(page).getByRole('combobox', { name: 'Trace Kind', exact: true });
export const dialog = (page: Page): Locator => page.getByTestId('discard-dialog');
export const record = (page: Page, index: number): Locator =>
	page.getByTestId('ribbon-twin').getByRole('button').nth(index);
export const save = (page: Page): Locator =>
	editor(page).getByRole('button', { name: 'Сохранить', exact: true });

/** A Kind with one number field through the real Builder; optional when asked. */
export async function createKind(
	page: Page,
	name: string,
	field: string,
	options: { required?: boolean } = {}
): Promise<void> {
	await page.goto('/forms');
	await page.getByRole('button', { name: 'Новый Trace Kind', exact: true }).click();
	await page.getByLabel('Название Trace Kind').fill(name);
	await page.getByLabel('Название поля', { exact: true }).fill(field);
	await page.getByRole('combobox', { name: 'Тип поля', exact: true }).selectOption('number');
	if (options.required === false)
		await page.getByRole('checkbox', { name: 'Обязательное поле', exact: true }).uncheck();
	await page.getByRole('button', { name: 'Создать Trace Kind', exact: true }).click();
	await expect(page).toHaveURL(new RegExp('/forms/[^/]+$'));
}

export const badInput = (input: Locator): Promise<boolean> =>
	input.evaluate((element) => (element as HTMLInputElement).validity.badInput);

/** Every scenario of a spec runs with a clean console: page and console errors fail it. */
export function cleanConsole(test: TestType<{ page: Page }, object>, log: string): void {
	const errors: string[] = [];
	test.beforeEach(({ page }) => {
		errors.length = 0;
		page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
		});
	});
	test.afterEach(({ page }, info) => {
		appendFileSync(
			`${ARTIFACTS}/${log}`,
			`${info.titlePath.slice(1).join(' › ')} [${page.viewportSize()?.width}px]: ${
				errors.length ? errors.join(' | ') : 'clean'
			}\n`
		);
		expect(errors).toEqual([]);
	});
}
