import { expect, test } from '@playwright/test';
import { exportBackup } from '../public/helpers';
import { ARTIFACTS, editor } from './draft.helpers';
import {
	dateOf,
	datedRows,
	openHistorySpace,
	openKindHistory,
	versionTable,
	yearOf
} from './kind-history.helpers';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

/** The count the table states for its dated rows under the active filters. */
const statedRows = async (table: import('@playwright/test').Locator): Promise<number> => {
	const text = await table.innerText();
	const match = /(\d+) запис[а-яё]* с датой/.exec(text);
	expect(match, text.slice(0, 200)).not.toBeNull();
	return Number(match![1]);
};

/**
 * S18 after a backdated edit: a record opened from the second page of a filtered history is
 * moved years back; the history is where it was — its value filter, its second page — and the
 * row is where its new date puts it, last of the dated rows, with the stored time of the new
 * date. The designed «Замер» history has 83 dated rows of version 2, including three coarse
 * dates. «Вес ≥ 80» keeps 63, more than one page of 50 and fewer than all of them.
 */
test('a filtered history on its second page keeps its filter and page across a backdated edit; the row moves to its new date', async ({
	page
}) => {
	test.setTimeout(150_000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await openHistorySpace(page);
	await openKindHistory(page, 'Замер');
	const surface = page.getByTestId('kind-data-surface');
	const v2 = versionTable(page, 2);
	await expect(datedRows(v2)).toHaveCount(50);
	const unfiltered = await statedRows(v2);
	await surface.getByText('Фильтры истории', { exact: true }).click();
	await surface.getByRole('combobox', { name: 'Поле' }).selectOption({ label: 'Вес' });
	await surface.getByRole('combobox', { name: 'Условие' }).selectOption({ label: 'не меньше' });
	await surface.getByTestId('history-value').fill('80');
	await surface.getByRole('button', { name: 'Добавить условие', exact: true }).click();
	await expect(surface.getByTestId('history-active')).toContainText('Вес >= 80');
	// The filter keeps more than one page and fewer than all rows; the second page is real.
	const filtered = await statedRows(v2);
	expect(filtered).toBeGreaterThan(50);
	expect(filtered).toBeLessThan(unfiltered);
	await expect(v2).toContainText('Страница 1 из 2');
	await v2.getByRole('button', { name: 'Следующая', exact: true }).click();
	await expect(v2).toContainText('Страница 2 из 2');
	await expect(datedRows(v2)).toHaveCount(filtered - 50);
	const row = datedRows(v2).first();
	const id = await row.getAttribute('data-trace-id');
	const before = await dateOf(row);

	// Opened from the table and moved to March 2020, month precision.
	await row.getByRole('button', { name: 'Открыть запись' }).click();
	await expect(page.getByTestId('context-overview')).toBeVisible();
	await page.getByTestId('edit-trace').click();
	await editor(page).getByTestId('trace-time').click();
	await page.getByText('Уточнить дату…', { exact: true }).click();
	await page.getByLabel('Точность даты', { exact: true }).selectOption('month');
	await page.getByRole('combobox', { name: 'Год', exact: true }).selectOption('2020');
	await page.getByRole('button', { name: 'Применить время', exact: true }).click();
	await editor(page).getByTestId('edit-save').click();
	await expect(page.getByTestId('context-overview')).toBeVisible();
	await expect(page.getByTestId('selected-time')).toContainText('2020');
	await page.getByTestId('context-collapse').click();

	// The history as left: the filter, the second page; the row last by its new date.
	await expect(surface).toBeVisible();
	await expect(surface.getByTestId('history-active')).toContainText('Вес >= 80');
	await expect(v2).toContainText('Страница 2 из 2');
	expect(await statedRows(v2)).toBe(filtered);
	await expect(datedRows(v2)).toHaveCount(filtered - 50);
	const moved = datedRows(v2).last();
	await expect(moved).toHaveAttribute('data-trace-id', id!);
	expect(yearOf(await dateOf(moved))).toBe(2020);
	expect(await dateOf(moved)).not.toBe(before);
	await page.screenshot({ path: `${ARTIFACTS}/i7-history-backdated-1440.png`, fullPage: true });

	const backup = await exportBackup(page);
	const stored = backup.collections.traces.find((trace: { id: string }) => trace.id === id);
	expect(JSON.stringify(stored.aboutTime)).toContain('2020');
	expect(errors).toEqual([]);
});
