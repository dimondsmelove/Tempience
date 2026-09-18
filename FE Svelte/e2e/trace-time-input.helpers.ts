import { expect, type Page } from '@playwright/test';

type StoredTrace = Record<string, unknown> & { encoding?: Record<string, number> };

/**
 * A stored Trace as the app reads it: a rewritten `aboutTime` or `data` is stored as `[value]`
 * with `encoding.<field> === 1` (the I3a codec; rows are never rewritten proactively), so an
 * export carries that shape after an edit and the plain one for a row never edited.
 */
export const decoded = <T extends StoredTrace>(trace: T): T => {
	const row = { ...trace };
	for (const field of ['aboutTime', 'data'] as const) {
		const value = row[field];
		if (row.encoding?.[field] === 1 && Array.isArray(value)) row[field] = value[0];
	}
	return row;
};
export async function openCapture(page: Page, text = 'Сегодня чтение C10') {
	await page.addInitScript(() => {
		if (!localStorage.getItem('tempience.data-space.active'))
			localStorage.setItem('tempience.data-space.active', 'belgrade-what-if-v1');
	});
	await page.clock.setFixedTime(new Date('2026-09-09T10:00:00+02:00'));
	await page.goto('/');
	await page.getByTestId('capture').click();
	const scopes = page.getByLabel('Выбрать Scope', { exact: true });
	await expect(scopes.locator('option').nth(1)).toBeAttached();
	await scopes.selectOption((await scopes.locator('option').nth(1).getAttribute('value'))!);
	await page.getByLabel('Название', { exact: true }).fill(text);
	await page.getByTestId('trace-time').click();
}
export async function digits(page: Page, label: string, value: string) {
	await page
		.getByRole('listbox', { name: label, exact: true })
		.locator('[aria-selected=true]')
		.focus();
	await page.keyboard.type(value);
}
export async function settle(page: Page) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
	});
}
export async function revealTrace(page: Page, id: string) {
	await expect(page.getByTestId('time-workbench')).toHaveAttribute('data-status', 'ready');
	const twin = page.locator(`[data-testid=ribbon-twin] button[data-trace-id="${id}"]`).first();
	await twin.focus();
	await twin.press('Enter');
	await settle(page);
}
