import { expect, type Page } from '@playwright/test';

export async function openEditor(page: Page) {
	await page.getByRole('button', { name: 'Внешний вид', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Внешний вид' })).toBeVisible();
}
