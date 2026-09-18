import { expect, test, type Page } from '@playwright/test';
import { loadTime, toggleLegend } from './helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const context = (page: Page) => page.getByRole('complementary', { name: 'Context' });
const heading = (page: Page) => context(page).getByTestId('selected-title');
const months = (page: Page) =>
	page.getByRole('group', { name: 'Подписи оси' }).locator('button[data-row="major"]');
/** Every axis label is a period; its accessible name is the period title (DESIGN.md §6). */
const openMonth = async (page: Page, index = 2): Promise<string> => {
	const label = months(page).nth(index);
	const name = (await label.getAttribute('aria-label')) ?? '';
	await label.dispatchEvent('click');
	await expect(heading(page)).toHaveText(name);
	return name;
};

test('a period lists its records by Scope and walks to the neighbouring periods', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	const month = await openMonth(page);
	const panel = context(page).getByTestId('context-period');
	await expect(panel).toContainText('Месяц ·');
	const records = panel.getByTestId('period-record');
	await expect(records.first()).toBeVisible();
	const first = await records.first().innerText();
	await records.first().click();
	await expect(context(page).getByTestId('context-overview')).toBeVisible();
	expect(first).toContain(await heading(page).innerText());
	await expect(page.getByTestId('history-position')).toHaveText('2 / 2');
	await page.getByTestId('history-back').click();
	await expect(heading(page)).toHaveText(month);
	await panel.getByTestId('period-next').click();
	await expect(heading(page)).not.toHaveText(month);
	await expect(context(page).getByTestId('context-period')).toContainText('Месяц ·');
	await context(page).getByTestId('period-parent').click();
	await expect(heading(page)).toHaveText(/^\d{4}( год)?$/);
	await expect(context(page).getByTestId('context-period')).toContainText('Год ·');
});

test('a period note is written to the persisted Period and survives a reload', async ({ page }) => {
	await loadTime(page, { manifest: 'dense' });
	const month = await openMonth(page);
	const note = context(page).getByTestId('period-note');
	await note.getByRole('button', { name: 'Добавить заметку' }).click();
	await note.getByLabel('Заметка периода').fill('Заметка e2e для периода');
	await note.getByRole('button', { name: 'Сохранить' }).click();
	await expect(note.getByRole('status')).toHaveText('Заметка сохранена');
	await expect(note).toContainText('Заметка e2e для периода');
	await expect(note.getByRole('button', { name: 'Изменить заметку' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('button', { name: 'Записать', exact: true })).toBeVisible({
		timeout: 20_000
	});
	await openMonth(page);
	await expect(heading(page)).toHaveText(month);
	await expect(context(page).getByTestId('period-note')).toContainText('Заметка e2e для периода');
});

test('the selected month follows Scope search and the legend while disclosure leaves its records intact', async ({
	page
}) => {
	await loadTime(page, { manifest: 'dense' });
	await openMonth(page);
	const records = context(page).getByTestId('period-record');
	const ids = () =>
		records.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-trace-id')).sort());
	const all = await ids();
	await page.getByRole('button', { name: 'Раскрыть Scope Работа', exact: true }).click();
	expect(await ids()).toEqual(all);
	await page.getByRole('searchbox', { name: 'Поиск Scope' }).fill('Работа');
	await expect.poll(async () => (await ids()).length).toBeLessThan(all.length);
	await expect(records.first()).toBeVisible();
	await expect(context(page).getByRole('heading', { name: /^Дом / })).toHaveCount(0);
	await toggleLegend(page, 'moment');
	const remaining = await ids();
	expect(remaining.length).toBeLessThan(all.length);
	await page.getByRole('searchbox', { name: 'Поиск Scope' }).fill('совпадений нет');
	await expect(records).toHaveCount(0);
	await expect(context(page).getByText('В этом периоде записей нет.')).toBeVisible();
});
