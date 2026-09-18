import { expect, test } from '@playwright/test';
import {
	dateOf,
	datedRows,
	openCatalog,
	openHistorySpace,
	versionTable,
	yearOf
} from './kind-history.helpers';

for (const width of [390, 1440]) {
	test.describe('Kind history at ' + width, () => {
		test.use({
			actionTimeout: 5000,
			viewport: { width, height: 900 },
			isMobile: width === 390,
			hasTouch: width === 390
		});
		test('one history per Kind: tables per own version, pages by event, explicit filters, a kept return', async ({
			page
		}) => {
			test.setTimeout(120_000);
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await openHistorySpace(page);

			// Entry from the timeline toolbar: the catalog in the Context, one Kind's history in the centre.
			const center = await openCatalog(page);
			// The catalog is filtered by name (its Scope filter is still a hypothesis, not a control).
			await center.getByLabel('Найти Trace Kind').fill('нет такого');
			await expect(center.getByText('Ничего не найдено.')).toBeVisible();
			await center.getByLabel('Найти Trace Kind').fill('зам');
			await expect(center.getByRole('combobox', { name: 'Scope', exact: true })).toHaveCount(0);
			await center.getByRole('button', { name: 'Замер', exact: true }).click();
			await center.getByTestId('kind-data').click();
			const surface = page.getByTestId('kind-data-surface');
			await expect(surface).toBeVisible();
			await expect(surface.getByTestId('history-active')).toContainText('Фильтров нет');

			// Version 2 first, with its own fields; the backdated records stay in its table.
			const v2 = versionTable(page, 2);
			const v1 = versionTable(page, 1);
			await expect(page.getByTestId('version-table').first()).toContainText('Версия 2');
			await expect(v2.getByRole('columnheader', { name: 'Пульс', exact: true })).toBeVisible();
			await expect(v1.getByRole('columnheader', { name: 'Пульс', exact: true })).toHaveCount(0);
			await expect(v2).toContainText('83 записи с датой');
			await expect(datedRows(v2)).toHaveCount(50);
			await expect(v2).toContainText('Страница 1 из 2');
			await expect(datedRows(v1)).toHaveCount(40);
			await expect(v1.getByText('Страница', { exact: false })).toHaveCount(0);
			// Newest event first, whatever the order of entry.
			const first = await dateOf(datedRows(v2).nth(0));
			const second = await dateOf(datedRows(v2).nth(1));
			expect(first).toContain('21 мар. 2026');
			expect(second).toContain('20 мар. 2026');
			await v2.getByRole('button', { name: 'Следующая', exact: true }).click();
			await expect(v2).toContainText('Страница 2 из 2');
			await expect(datedRows(v2)).toHaveCount(33);
			expect(yearOf(await dateOf(datedRows(v2).last()))).toBe(2024);
			await page.screenshot({ path: 'e2e/artifacts/kind-history-page2-' + width + '.png' });

			// The records without a date are a group of their own, reachable on purpose.
			const undated = v2.getByTestId('undated-group');
			await expect(undated).toContainText('Без даты (5)');
			await expect(v2.getByTestId('undated-row')).toHaveCount(0);
			await undated.locator('summary').click();
			await expect(v2.getByTestId('undated-row')).toHaveCount(5);

			// A record opens on the right; the table stays where it was, page and filters alike.
			const open = datedRows(v2).first().getByRole('button', { name: 'Открыть запись' });
			await open.focus();
			await page.keyboard.press('Enter');
			await expect(page.getByTestId('context-overview')).toBeVisible();
			await page.getByTestId('context-collapse').click();
			await expect(surface).toBeVisible();
			await expect(v2).toContainText('Страница 2 из 2');
			await expect(v2.getByTestId('undated-row')).toHaveCount(5);

			// Explicit filters, each visible while it applies, before any page.
			await surface.getByText('Фильтры истории', { exact: true }).click();
			await surface.getByTestId('history-from').fill('2026-03-01');
			await surface.getByTestId('history-from').dispatchEvent('change');
			await expect(surface.getByTestId('history-active')).toContainText('2026-03-01 — …');
			await expect(v2).toContainText('21 запись с датой');
			// One page only: nothing to turn.
			await expect(v2.getByText('Страница', { exact: false })).toHaveCount(0);
			await expect(datedRows(v1)).toHaveCount(0);
			await expect(v2.getByTestId('undated-group')).toHaveCount(0);
			await surface.getByRole('combobox', { name: 'Поле' }).selectOption({ label: 'Вес' });
			await surface.getByRole('combobox', { name: 'Условие' }).selectOption({ label: 'больше' });
			await surface.getByTestId('history-value').fill('90');
			await surface.getByRole('button', { name: 'Добавить условие', exact: true }).click();
			await expect(surface.getByTestId('history-active')).toContainText('Вес > 90');
			await expect(datedRows(v2)).toHaveCount(5);
			await surface
				.getByRole('combobox', { name: 'Scope', exact: true })
				.selectOption({ label: 'Здоровье' });
			await expect(surface.getByTestId('history-active')).toContainText('Scope: Здоровье');
			await expect(datedRows(v2)).toHaveCount(3);
			await surface.getByRole('checkbox', { name: 'Версия 1', exact: true }).uncheck();
			await expect(page.getByTestId('version-table')).toHaveCount(1);
			await expect(surface.getByTestId('history-filters-count')).toHaveText('4');
			await page.screenshot({ path: 'e2e/artifacts/kind-history-filters-' + width + '.png' });
			await surface.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
			await expect(surface.getByTestId('history-active')).toContainText('Фильтров нет');
			await expect(page.getByTestId('version-table')).toHaveCount(2);
			await expect(datedRows(v2)).toHaveCount(50);

			// The columns of one version's table are its own choice.
			await v2.getByText('Колонки', { exact: true }).click();
			await v2.getByRole('checkbox', { name: 'Пульс', exact: true }).uncheck();
			await expect(v2.getByRole('columnheader', { name: 'Пульс', exact: true })).toHaveCount(0);
			await v2.getByRole('checkbox', { name: 'Заметка', exact: true }).check();
			// The dated table and the open group without a date both show the version's columns.
			await expect(v2.getByRole('columnheader', { name: 'Заметка', exact: true })).toHaveCount(2);

			// Entry from the Scope panel: the same history, as left.
			await page.getByRole('button', { name: 'Лента', exact: true }).first().click();
			await expect(surface).toHaveCount(0);
			if (width === 390) await page.getByRole('button', { name: 'Scope', exact: true }).click();
			await page.getByRole('button', { name: 'Выбрать Scope Здоровье', exact: true }).click();
			await expect(page.getByTestId('context-scope')).toBeVisible();
			await page.getByRole('button', { name: 'Открыть историю «Замер»', exact: true }).click();
			await expect(surface).toBeVisible();
			await expect(surface.getByTestId('history-active')).toContainText('Фильтров нет');
			await expect(
				v2.getByRole('columnheader', { name: 'Заметка', exact: true }).first()
			).toBeVisible();
			await expect(datedRows(v2)).toHaveCount(50);
			expect(errors).toEqual([]);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		});
	});
}
